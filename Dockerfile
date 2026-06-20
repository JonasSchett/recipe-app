# syntax=docker/dockerfile:1

# ---- Dependencies -----------------------------------------------------------
FROM node:20-alpine AS deps
# Prisma needs OpenSSL at install/generate time.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ---- Builder ----------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `build` runs `prisma generate` then `next build` (see package.json).
RUN npm run build

# ---- Production deps --------------------------------------------------------
# A production-only node_modules that still contains the Prisma CLI (prisma is a
# runtime dependency) plus all of its transitive deps, so `prisma migrate deploy`
# works in the runtime image without shipping dev tooling.
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# ---- Runner -----------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server output and static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Overlay the full production node_modules (a superset of the standalone one) so
# the Prisma CLI and its deps are present for `prisma migrate deploy` at startup.
# npm created proper `.bin` symlinks, so `npx prisma` resolves correctly.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Writable directory for uploaded recipe images (mounted as a volume).
RUN mkdir -p ./public/uploads/recipes && chown -R nextjs:nodejs ./public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
