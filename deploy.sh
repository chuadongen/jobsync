#!/usr/bin/env bash
# Update JobSync on the server: pull the latest code, rebuild, restart.
# Usage: ./deploy.sh [branch]      (default: the branch currently checked out)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env here. Copy .env.example to .env and fill it in first (see README, Deployment)." >&2
  exit 1
fi

branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
echo "Updating to origin/${branch}..."
git fetch origin "$branch"
git checkout "$branch"
git pull --ff-only origin "$branch"

echo "Building and restarting..."
docker compose up -d --build
docker image prune -f >/dev/null

echo "Waiting for JobSync to answer..."
port="$(grep -E '^JOBSYNC_PORT=' .env | cut -d= -f2)"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${port:-3737}/signin"; then
    echo "JobSync is up."
    exit 0
  fi
  sleep 2
done
echo "JobSync did not answer within a minute. Check: docker compose logs --tail 50" >&2
exit 1
