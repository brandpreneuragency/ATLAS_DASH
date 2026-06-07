# Multi-stage Dockerfile for the TABS API service.
#
# Build context: the repo root (see `api.build.context` in docker-compose.yml).
# The Dockerfile itself lives at `server/Dockerfile` so the build context is
# the parent directory and we copy `server/<thing>` paths explicitly.
#
# Build:    docker build -t tabs-api -f server/Dockerfile .
# Run:      docker run --rm -p 4000:4000 --env-file .env tabs-api
#
# The image is multi-stage: the builder stage compiles TypeScript and runs
# `prisma generate` so the runtime stage does not need `prisma`, `tsx`, or the
# dev toolchain. The runtime stage runs as a non-root user and only carries the
# compiled `dist/`, the generated Prisma client, and the production node_modules
# subset.

# ---- 1. Builder -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (including dev) so we can build. We are in /app; the
# server's package.json is at /app/server/package.json.
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm install --no-audit --no-fund

# Copy the rest of the server source. The prisma schema is required for
# `prisma generate`.
COPY server/tsconfig.json server/tsconfig.build.json ./
COPY server/prisma ./prisma
COPY server/src ./src

# Generate the Prisma client and compile TypeScript.
RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json

# Prune dev dependencies so the runtime image is small.
RUN npm prune --omit=dev


# ---- 2. Runtime -------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app/server

# Run as a non-root user. The `node` image ships with a `node` user (uid 1000).
COPY --from=builder --chown=node:node /app/server/package.json /app/server/package-lock.json* ./
COPY --from=builder --chown=node:node /app/server/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/server/dist ./dist
# The Prisma client lives in node_modules/@prisma/client, which is already copied.
# We also copy the schema file so `prisma migrate deploy` (if run inside the
# container) can find it.
COPY --from=builder --chown=node:node /app/server/prisma ./prisma

USER node
ENV NODE_ENV=production

EXPOSE 4000

# Healthcheck against the live `/api/health` endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
