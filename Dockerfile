FROM node:20.20.2-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The public address is baked into the build: Next only accepts form
# submissions (server actions) from origins it knows, and behind a proxy
# such as tailscale serve that origin is this address.
ARG NEXTAUTH_URL=""
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV DATABASE_URL=file:/data/jobsync.db
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -h /home/nextjs nextjs

# Migrations run at start-up; installing the CLI here avoids a download on
# every restart.
RUN npm install -g prisma@6.19.0 && npm cache clean --force

RUN mkdir .next && chown nextjs:nodejs .next
RUN mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3737
ENV PORT=3737

ENTRYPOINT ["/app/docker-entrypoint.sh"]
