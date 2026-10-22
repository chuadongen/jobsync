#!/usr/bin/env bash
# One-time setup for a Codespace: install, write .env, create the database.
set -euo pipefail

npm ci

if [ ! -f .env ]; then
  if [ -n "${CODESPACE_NAME:-}" ]; then
    url="https://${CODESPACE_NAME}-3737.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  else
    url="http://localhost:3737"
  fi
  cat > .env <<ENV
DATABASE_URL=file:./dev.db
TZ=Asia/Singapore
NEXTAUTH_URL=${url}
AUTH_TRUST_HOST=true
AUTH_SECRET=$(openssl rand -base64 32)
MCP_ENABLED=true
ENV
  echo "Wrote .env for ${url}"
fi

npx prisma migrate deploy
