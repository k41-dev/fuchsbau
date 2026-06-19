# Fuchsbau

Time tracking for construction crews — clock in and out on site, manage breaks and absences, supervise live crews, and export payroll reports.

## Features

- **Worker dashboard** — clock in/out, breaks, sick days, vacation; switch between job sites
- **Offline-first PWA** — queue actions in IndexedDB when signal is poor; sync with original tap timestamps on reconnect
- **Supervisor tools** — manage job sites, invite workers, approve absences, correct time entries
- **Reports** — hours and absence summaries with CSV export
- **Production-ready** — Docker Compose stack with automatic migrations and health checks

## Stack

- SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS
- PostgreSQL with Drizzle ORM
- Better Auth (email/password)

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- Docker (for local PostgreSQL)

## Quick start

```bash
npm install

cp .env.example .env
# Set BETTER_AUTH_SECRET to a random string (32+ characters)

docker compose up -d
npm run db:migrate
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Demo data

```bash
npm run db:seed
```

Creates five accounts (password for all: `demo1234`):

| Email | Role |
|-------|------|
| `anna.supervisor@demo.fuchsbau` | Supervisor — owns all demo sites |
| `lukas.worker@demo.fuchsbau` | Worker on two sites (good for switch testing) |
| `maria.worker@demo.fuchsbau` | Worker |
| `tim.worker@demo.fuchsbau` | Worker |
| `sara.worker@demo.fuchsbau` | Worker |

Re-running the seed resets demo data only (`@demo.fuchsbau` emails).

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth signing secret (min 32 characters) |
| `BETTER_AUTH_URL` | Public app URL (e.g. `http://localhost:5173`) |
| `ORIGIN` | Public URL for production (required behind HTTPS) |
| `BODY_SIZE_LIMIT` | Max upload size for form actions (default `6M`) |

See `.env.example` and `.env.production.example` for the full list.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run check` | TypeScript / Svelte check |
| `npm run test` | Unit and integration tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:seed` | Load demo accounts and data |
| `npm run db:studio` | Open Drizzle Studio |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Worker dashboard (mobile-first, offline-capable) |
| `/my-sites` | Worker's assigned job sites |
| `/projects` | Job site management (supervisor) |
| `/projects/[id]` | Site detail, live crew, invites |
| `/reports` | Hours and absence reports |
| `/login`, `/register` | Authentication |

Protected routes redirect unauthenticated users to `/login` with a `redirectTo` parameter.

## Database

Schema: `src/infrastructure/db/schema.ts`  
Migrations: `drizzle/`

```bash
# After changing the schema:
npm run db:generate
npm run db:migrate
```

## Tests

Unit tests run without extra setup. Integration tests use `DATABASE_URL` from `.env` and create temporary users that are cleaned up after each run.

```bash
npm run test
```

## Offline PWA

The worker dashboard supports poor-signal job sites:

- **Offline queue** — clock-in/out, breaks, and absences are saved locally when the network is unavailable
- **Optimistic UI** — timers keep running while offline
- **Auto-sync** — queued actions replay on reconnect using the original tap time (`clientTimestamp`)
- **Installable** — add to home screen on mobile (manifest + service worker)

Visit the app online once while signed in so job sites are cached. Supervisor routes require a live connection.

### Install on a phone (same network)

1. Find your machine's local IP (e.g. `192.168.1.42`).
2. Open `http://<your-ip>:5173` in Chrome (Android) or Safari (iOS).
3. **Android:** menu → *Install app* / *Add to Home screen*
4. **iOS:** Share → *Add to Home Screen*

## Testing on a phone over the internet (ngrok)

Use ngrok when you want to test the worker PWA on cellular data. The app must be reachable over **HTTPS** for auth cookies and "Add to Home Screen" to work reliably.

### 1. Start the app locally

```bash
docker compose up -d
npm run dev
```

The dev server listens on port **5173** and accepts tunnel host headers (see `vite.config.ts`).

### 2. Expose port 5173 with ngrok

**Option A — ngrok on the host (simplest):**

```bash
ngrok http 5173
```

Copy the `https://` forwarding URL from the ngrok dashboard (default: [http://localhost:4040](http://localhost:4040)).

**Option B — ngrok in Docker:**

If ngrok runs in a container, point the tunnel at the host machine:

```yaml
command:
  - http
  - --url=${NGROK_DOMAIN}   # optional: reserved domain
  - host.docker.internal:5173
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### 3. Configure auth for the public URL

```bash
cp .env.ngrok.example .env
```

Set `BETTER_AUTH_URL` to your ngrok HTTPS URL — exact match, no trailing slash. Restart the dev server:

```bash
npm run dev
```

### 4. Test on your phone

1. Open the ngrok HTTPS URL in the browser.
2. Dismiss the ngrok free-tier interstitial if shown.
3. Register or log in.
4. Add to home screen and toggle airplane mode briefly to confirm offline clock-in/out queues and syncs.

PostgreSQL must still run locally (`docker compose up -d`); ngrok only exposes the web app.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Blocked request" / invalid host | Ensure `npm run dev` is running with current `vite.config.ts` (`allowedHosts: true`). |
| Login loops or cookies missing | `BETTER_AUTH_URL` must equal the ngrok URL exactly, including `https://`. |
| `Invalid Origin` on login/register | Avoid extra quotes in `.env`. Restart `npm run dev` after editing. |
| 502 from ngrok | Dev server not running, or tunnel pointing at the wrong port. |
| DB errors on phone | Database runs on your dev machine, not through the tunnel. |

For the **production Docker stack**, point ngrok at port `3000` (or your `APP_PORT`) and set both `ORIGIN` and `BETTER_AUTH_URL` in `.env.production`.

## Production deployment

The app ships as a Node server (`adapter-node`) with PostgreSQL. The recommended path is Docker Compose on any host with Docker.

### 1. Configure production env

```bash
cp .env.production.example .env.production
```

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

This starts PostgreSQL with a persistent volume, runs Drizzle migrations automatically, and serves the app on port `3000` (or `APP_PORT`).

Health check: `GET /api/health` → `{ "ok": true }`

### 3. HTTPS reverse proxy

Put **Caddy** or **nginx** in front of the app for TLS. Example Caddyfile:

```caddy
fuchsbau.example.com {
  reverse_proxy localhost:3000
}
```

Update `ORIGIN` and `BETTER_AUTH_URL` to your HTTPS domain before starting the stack.

### 4. Deploy updates

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