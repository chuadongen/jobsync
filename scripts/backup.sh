#!/usr/bin/env bash
# Nightly backup: asks the running app for a consistent snapshot (database
# plus every file) and keeps the newest KEEP of them.
# Usage: scripts/backup.sh [destination-dir]
# Reads BACKUP_TOKEN and JOBSYNC_PORT from the .env beside docker-compose.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

dest="${1:-$HOME/jobsync-backups}"
keep="${KEEP:-30}"
token="$(grep -E '^BACKUP_TOKEN=' .env | cut -d= -f2-)"
port="$(grep -E '^JOBSYNC_PORT=' .env | cut -d= -f2-)"

if [ -z "$token" ]; then
  echo "BACKUP_TOKEN is not set in .env" >&2
  exit 1
fi

mkdir -p "$dest"
file="$dest/jobsync-$(date +%F-%H%M%S).zip"
code="$(curl -sS -H "Authorization: Bearer $token" -o "$file.part" -w '%{http_code}' \
  "http://127.0.0.1:${port:-3737}/api/backup")"

# Refuse anything that is not a zip: a redirect or error page saved under a
# .zip name would look like a backup until the day it is needed.
if [ "$code" != "200" ] || [ "$(head -c 2 "$file.part")" != "PK" ]; then
  rm -f "$file.part"
  echo "Backup failed (HTTP $code). Is JobSync running, and does BACKUP_TOKEN match?" >&2
  exit 1
fi
mv "$file.part" "$file"

# Keep the newest $keep backups.
ls -1t "$dest"/jobsync-*.zip 2>/dev/null | tail -n +"$((keep + 1))" | xargs -r rm --
echo "Saved $file"
