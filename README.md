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