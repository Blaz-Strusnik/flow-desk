# FlowDesk

Boards/lists/cards for project management, plus channels/messages for
team chat, in one app.

- **apps/api** — NestJS + Prisma + PostgreSQL, REST + Socket.IO
- **apps/web** — Next.js (App Router) + Tailwind + shadcn/ui
- **packages/shared-types** — Zod schemas, DTOs, and the WebSocket event
  contract shared by both apps

Managed as a Turborepo + pnpm workspace.

## Features

**Workspaces & members**

- Multiple workspaces per account, each with its own boards, channels, and
  member list.
- Invite existing accounts by email; OWNER/ADMIN can also remove members,
  which revokes their board, card, and channel access in that workspace.
- Workspace membership grants access to **every** board in the workspace
  (board role is derived from the workspace role). An explicit board
  membership is an override — e.g. to pin someone to read-only VIEWER.
- Roles: workspace OWNER / ADMIN / MEMBER, board OWNER / EDITOR / VIEWER.

**Boards, lists & cards**

- Drag-and-drop cards between lists and reorder lists, with fractional
  positioning and server-side rebalancing.
- Cards carry a description (rich text), **start date and due date**
  (shown as a range on the card), a cover color, assignees, comments, and
  file attachments.
- **Labels** with a name and color, rendered on board cards as colored
  chips with auto-contrasting text.
- Full-text search across cards and messages.
- Per-board activity log.

**Real-time**

- Socket.IO: live board updates (lists/cards created, moved, deleted) and
  presence indicators showing who else is on a board.
- Team chat with channels (public or private) and message history per
  workspace.

**Accounts**

- Email/password auth with short-lived JWT access tokens and rotating
  refresh tokens.
- In-app notifications (assignments, comments, mentions, due-soon).

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) via corepack: `corepack enable && corepack prepare pnpm@11.25.0 --activate`
- Docker + Docker Compose (for Postgres, and for the production build)

## Running in development

```bash
git clone <this-repo> flowdesk
cd flowdesk
pnpm install

# Start Postgres (listens on localhost:5433, not the Postgres default 5432)
docker compose up -d postgres

# Configure env vars
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# Defaults in both files already match the docker-compose Postgres above and
# talk to each other on localhost — no edits needed to just get it running.

# Apply migrations and generate the Prisma client
pnpm db:migrate
pnpm db:generate

# Start both apps (API on :3001, web on :3000)
pnpm dev
```

Open http://localhost:3000, register an account, and go.

Other useful commands, run from the repo root:

```bash
pnpm lint          # oxlint (api) + eslint (web)
pnpm typecheck
pnpm test          # unit + API e2e tests (vitest)
pnpm --filter web exec playwright test   # browser e2e tests
pnpm build
pnpm db:studio     # Prisma Studio, browse the dev database
```

## Running in production on a VPS

This deploys three containers on one host: Postgres, the API, and the web
app — each built from the repo's own multi-stage `Dockerfile`s, wired
together by `docker-compose.prod.yml`. A reverse proxy on the host handles
TLS in front of them.

### 1. Get the code and Docker onto the VPS

```bash
git clone <this-repo> flowdesk
cd flowdesk
# Install Docker + the Compose plugin if not already present
# (e.g. https://docs.docker.com/engine/install/ for your distro)
```

### 2. Configure environment variables

```bash
cp .env.production.example .env
```

Edit `.env` and fill in real values:

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | Random secret, e.g. `openssl rand -base64 32` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Two **different** random secrets, e.g. `openssl rand -base64 48` |
| `CORS_ORIGIN` | The public URL of the web app, e.g. `https://flowdesk.example.com` |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` | The public URL of the API, e.g. `https://api.flowdesk.example.com` |

`NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` get **baked into the web app's
JS bundle at build time** (a Next.js client-side env var constraint, not a
choice made here) — changing them later means rebuilding and redeploying
the `web` image, not just restarting the container.

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts Postgres and the API and web containers. The API and web
containers each bind only to `127.0.0.1` (see step 4 for why).

### 4. Put a reverse proxy in front (TLS)

The containers aren't exposed to the internet directly — point a reverse
proxy at them and terminate TLS there. With [Caddy](https://caddyserver.com)
(simplest — automatic HTTPS via Let's Encrypt), a `Caddyfile` on the host:

```
flowdesk.example.com {
    reverse_proxy 127.0.0.1:3000
}

api.flowdesk.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Point both domains' DNS `A` records at the VPS first. Any other reverse
proxy (Nginx, Traefik, etc.) works the same way — proxy the two domains to
`127.0.0.1:3000` and `127.0.0.1:3001` respectively, with WebSocket upgrade
headers passed through for the API domain (Socket.IO needs it).

### 5. Run migrations

Migrations are applied as a separate step, not automatically on container
start (avoids two instances racing to migrate on a redeploy):

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

Run this once after the first `up`, and again after every deploy that adds
a migration.

### 6. Verify

```bash
curl https://api.flowdesk.example.com/   # should return a 200
```

Visit `https://flowdesk.example.com` and register an account.

### Updating / redeploying

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm migrate
```

### Data persistence

Postgres data and uploaded attachments live in named Docker volumes
(`flowdesk_postgres_data`, `flowdesk_uploads`) — they survive
`docker compose down` and image rebuilds. Back them up with `docker run
--rm -v flowdesk_postgres_data:/data -v $(pwd):/backup alpine tar czf
/backup/pg-backup.tar.gz /data` (adjust the volume name for uploads).

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

## License

[MIT](LICENSE)
