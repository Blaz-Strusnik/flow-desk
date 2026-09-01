# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules /repo/packages/shared-types/node_modules
COPY --from=deps /repo/apps/web/node_modules /repo/apps/web/node_modules
COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
RUN pnpm --filter @flowdesk/shared-types build
# Build-time env: the API URL baked into the client bundle. Override via
# --build-arg for a different environment.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter web build

# ---- runtime: Next.js standalone output ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
