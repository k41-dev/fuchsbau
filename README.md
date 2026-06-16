# Fuchsbau

Construction crew time tracking — clock in/out on site, breaks, sick days, vacation, supervisor dashboard, and payroll reports.

## Stack

- SvelteKit 2 + Svelte 5, TypeScript, Tailwind
- PostgreSQL + Drizzle ORM
- Better Auth (email/password)

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- Docker (for local PostgreSQL)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET to a random string (32+ chars)

# 3. Start database
docker compose up -d

# 4. Run migrations
npm run db:migrate

# 5. Start dev server
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173).

### Demo accounts (local testing)

```bash
npm run db:seed
```

Creates 5 accounts (password for all: `demo1234`):

| Email | Role |
|-------|------|
| `anna.supervisor@demo.fuchsbau` | Supervisor — owns all demo sites |
| `lukas.worker@demo.fuchsbau` | Worker on 2 sites (good for switch testing) |
| `maria.worker@demo.fuchsbau` | Worker |
| `tim.worker@demo.fuchsbau` | Worker |
| `sara.worker@demo.fuchsbau` | Worker |

Re-running the seed resets demo data only (`@demo.fuchsbau` emails).

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth signing secret (min 32 characters) |
| `BETTER_AUTH_URL` | Public app URL (e.g. `http://localhost:5173`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run check` | TypeScript / Svelte check |
| `npm run test` | Run tests (unit + DB integration) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:studio` | Open Drizzle Studio |

## Database migrations

Schema lives in `src/infrastructure/db/schema.ts`. SQL migrations are in `drizzle/`.

```bash
# After changing the schema:
npm run db:generate
npm run db:migrate
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Mobile worker dashboard |
| `/projects` | Job sites (supervisor) |
| `/projects/[id]` | Site detail + live crew |
| `/reports` | Hours & absence reports |
| `/login`, `/register` | Authentication |

Protected routes redirect unauthenticated users to `/login` with a `redirectTo` parameter.

## Tests

Unit tests run without extra setup. Integration tests use `DATABASE_URL` from `.env` and create temporary users that are cleaned up after the run.

```bash
npm run test
```

## Offline & PWA (worker home)

The worker dashboard (`/`) supports poor-signal job sites:

- **Offline queue** — clock-in/out, breaks, and absences are saved to IndexedDB (Dexie) when the network is unavailable
- **Optimistic UI** — timers keep running locally while offline
- **Auto-sync** — queued actions replay when you reconnect, using the original tap time (`clientTimestamp`)
- **Installable app** — add to home screen on mobile (PWA manifest + service worker)

Visit the app online once while signed in so job sites are cached. Supervisor routes (`/projects`, `/reports`) require a live connection.

## Testing with ngrok (phone on cellular)

Use ngrok when you want to test the worker PWA on a real phone without being on the same Wi‑Fi. The app must be reachable over **HTTPS** for auth cookies and “Add to Home Screen” to work reliably.

### 1. Start Fuchsbau locally

```bash
docker compose up -d
npm run dev
```

Dev server listens on port **5173** and accepts ngrok host headers (see `vite.config.ts`).

### 2. Point your ngrok tunnel at Fuchsbau

Your existing ngrok container (`mcp_config`) currently forwards to `mcp-server:8321`. To aim it at this project instead, edit the ngrok service in:

`/home/k41/Documents/System_Configs/mcp_config/docker-compose.yml`

Change the tunnel target and allow the container to reach the host:

```yaml
  ngrok:
    image: ngrok/ngrok:latest
    container_name: ngrok
    command:
      - http
      - --url=${NGROK_DOMAIN}
      - --log=stdout
      - --log-level=info
      - host.docker.internal:5173    # was: mcp-server:8321
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
      - MCP_PUBLIC_URL=${MCP_PUBLIC_URL}
      - NGROK_DOMAIN=${NGROK_DOMAIN}
    ports:
      - "4042:4040"
    restart: unless-stopped
    networks:
      app-net:
        ipv4_address: 172.29.0.8
```

Notes:

- **Reserved domain** — if you keep `NGROK_DOMAIN` / `--url=…` the same, the public URL stays `https://nonblamably-noninoculative-cleora.ngrok-free.dev`. Only the backend port changes.
- **MCP is offline** while the tunnel points at Fuchsbau. Switch the target back to `mcp-server:8321` when you need MCP again.
- **Second tunnel** — ngrok paid plans can run multiple tunnels; on free tier you typically swap the target or run a separate `ngrok http 5173` on the host (ephemeral URL each restart).

Recreate the tunnel:

```bash
cd /home/k41/Documents/System_Configs/mcp_config
docker compose up -d ngrok
```

Confirm the URL at [http://localhost:4042](http://localhost:4042) (ngrok web UI).

**Production Docker stack** — point ngrok at `host.docker.internal:3000` (or your `APP_PORT`) instead of `5173`, and set `ORIGIN` as well as `BETTER_AUTH_URL` in `.env.production`.

### 3. Configure auth for the public URL

```bash
cp .env.ngrok.example .env
# Edit BETTER_AUTH_URL to your ngrok HTTPS URL (exact match, no trailing slash)
```

Restart the dev server after editing `.env`:

```bash
npm run dev
```

`BETTER_AUTH_URL` must match what you type in the phone browser. Better Auth uses it for cookies and redirects.

### 4. Test on your phone

1. Open the ngrok HTTPS URL in Chrome (Android) or Safari (iOS).
2. Dismiss the ngrok free-tier interstitial if shown (“Visit Site”).
3. Register or log in.
4. **Add to Home Screen** — Android: menu → *Install app*; iOS: Share → *Add to Home Screen*.
5. Toggle airplane mode briefly to confirm offline clock-in/out still queues and syncs.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Blocked request” / invalid host | Ensure `npm run dev` is running with current `vite.config.ts` (`allowedHosts: true`). |
| Login loops or cookies missing | `BETTER_AUTH_URL` must equal the ngrok URL exactly (including `https://`). |
| `Invalid Origin` on login/register | Extra quotes in `.env` break the match — use `BETTER_AUTH_URL="https://….ngrok-free.dev"` (one pair of quotes only). Restart `npm run dev` after editing. |
| 502 from ngrok | Dev server not running, wrong port, or tunnel still pointing at `mcp-server:8321`. |
| DB errors on phone | PostgreSQL must run on the host (`docker compose up -d` in this repo); ngrok only exposes the web app. |

## Production deployment (Docker)

The app ships as a Node server (`adapter-node`) with PostgreSQL. The recommended path is Docker Compose on a VPS (Hetzner, DigitalOcean, etc.) or any host with Docker.

### 1. Configure production env

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

| Variable | Example | Notes |
|----------|---------|-------|
| `ORIGIN` | `https://fuchsbau.example.com` | Public URL — required by SvelteKit behind HTTPS |
| `BETTER_AUTH_URL` | same as `ORIGIN` | Must match browser URL exactly |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Min 32 characters |
| `POSTGRES_PASSWORD` | strong random password | Database password |
| `APP_PORT` | `3000` | Host port exposed to the internet |

### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This will:

1. Start PostgreSQL with a persistent volume
2. Run Drizzle migrations automatically
3. Start the app on port `3000` (or `APP_PORT`)

Health check: `GET /api/health` → `{ "ok": true }`

### 3. HTTPS reverse proxy

Put **Caddy** or **nginx** in front of the app for TLS. Example Caddyfile:

```caddy
fuchsbau.example.com {
  reverse_proxy localhost:3000
}
```

Update `ORIGIN` and `BETTER_AUTH_URL` to `https://fuchsbau.example.com` before starting the stack.

### 4. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run on every container start.

### Run without Docker

```bash
npm ci
npm run build
export DATABASE_URL=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=... ORIGIN=...
npm run db:migrate:prod
npm start
```

### Install on phone

**Same Wi‑Fi:** open `http://<your-host>:5173` in Chrome/Safari.

**Over the internet:** use [Testing with ngrok](#testing-with-ngrok-phone-on-cellular) and the HTTPS ngrok URL.

Then:

1. **Android:** menu → *Install app* / *Add to Home screen*
2. **iOS:** Share → *Add to Home Screen*