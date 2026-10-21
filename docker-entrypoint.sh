#!/bin/sh
set -e

# AUTH_SECRET signs login sessions. When .env does not set one, generate it
# once and keep it on the data volume, so restarts do not log you out.
if [ -z "$AUTH_SECRET" ]; then
  if [ ! -s /data/.auth_secret ]; then
    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" > /data/.auth_secret
    chmod 600 /data/.auth_secret
    echo "Generated AUTH_SECRET and stored it in /data/.auth_secret"
  fi
  export AUTH_SECRET="$(cat /data/.auth_secret)"
fi

prisma migrate deploy --schema /app/prisma/schema.prisma

chown -R nextjs:nodejs /data
export HOME=/home/nextjs
exec su -s /bin/sh nextjs -c "HOSTNAME=0.0.0.0 PORT=${PORT:-3737} node server.js"
