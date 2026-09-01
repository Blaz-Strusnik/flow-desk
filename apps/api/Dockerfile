# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ---- deps: install the full workspace's dependencies ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# ---- build: generate the Prisma client, build shared-types + the API, then
# `pnpm deploy` the api package into a self-contained (non-symlinked)
# node_modules — apps/api/node_modules on its own only has symlinks into the
# shared pnpm virtual store, which the runtime image doesn't have. ----
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules /repo/packages/shared-types/node_modules
COPY --from=deps /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @flowdesk/shared-types build
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /repo/deploy/api

# ---- runtime: slim image with only what's needed to run ----
FROM node:22-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/deploy/api ./

EXPOSE 3001
# Migrations are applied as a separate release-phase step (prisma migrate
# deploy), not on container start, to avoid concurrent-instance races.
CMD ["node", "dist/main.js"]
