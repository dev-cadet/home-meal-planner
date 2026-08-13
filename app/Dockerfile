# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Home Meal Planner — single-service image.
#
# Bun installs; Node builds and runs.
#
# Bun owns the lockfile, so it does the install. It does *not* run the build:
# `bun run build` dies with SIGILL inside the container on CPUs without the
# instruction set Bun's default binary assumes. Node builds Next natively and
# has no such constraint, so the split avoids the problem entirely rather than
# depending on the host's CPU.
#
# Both native dependencies (libsql and sharp) have well-trodden glibc
# prebuilds, so every stage is debian-slim rather than Alpine — musl would drag
# a compiler toolchain into the image (docs/plan.md §3).
# ---------------------------------------------------------------------------

# --- dependencies ----------------------------------------------------------
FROM oven/bun:1.3-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
# Installed inside the target platform so the binaries for libsql and sharp
# are the ones the runtime stage will actually load.
RUN bun install --frozen-lockfile

# --- build -----------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# A build-time placeholder. The real secret arrives at runtime; auth is
# constructed lazily, so nothing here needs a valid one.
ENV BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

RUN node node_modules/next/dist/bin/next build

# --- runtime ---------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/app.db \
    MIGRATIONS_DIR=/app/drizzle

# Run as the image's existing unprivileged user rather than root.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Migrations are read from disk at boot by instrumentation.ts, so they are
# copied in rather than bundled.
COPY --from=build --chown=node:node /app/drizzle ./drizzle

USER node

EXPOSE 3000

# The volume must be the *directory*: WAL writes app.db-wal and app.db-shm
# alongside the database, and mounting the bare file corrupts on restart.
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
