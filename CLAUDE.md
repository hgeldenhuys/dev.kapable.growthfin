# GrowthFin CRM

## What is this?

GrowthFin is a CRM application being migrated from SignalDB v1 to the Kapable platform.
Source: `/Users/hgeldenhuys/WebstormProjects/growthfin/`
Migration plan: `docs/plans/2026-03-18-growthfin-migration.md` (in parent kapable repo)

## Current Status: Phase 2 Complete (Database + Local Dev)

The api + web apps and all 10 packages build cleanly. Database is set up locally and both servers run.

### Phase roadmap
- **Phase 1** (DONE): Scaffold — copy api + web, get building
- **Phase 2** (DONE): Database setup — local Postgres, 135 tables, dev servers running
- **Phase 3**: Replace SignalDB auth with Kapable auth
- **Phase 4**: Migrate data layer from Drizzle/direct-DB to Kapable Data API
- **Phase 5**: Replace channels/providers with Kapable platform services
- **Phase 6**: Deploy as Kapable Connect App

## Running Locally

```bash
# First time setup
bun install

# Database setup (requires local PostgreSQL on port 5432)
# 1. Create database: psql -h localhost -d postgres -c "CREATE DATABASE growthfin_clean;"
# 2. Create extensions: psql -h localhost -d growthfin_clean -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
# 3. Create missing enums (see packages/db/missing-enums.sql)
# 4. Push schema: cd packages/db && DATABASE_URL="..." bun run push-schema.ts

# Start dev servers
cd apps/api && bun run dev    # API on http://localhost:3000
cd apps/web && bun run dev    # Web on http://localhost:5173
```

### Required .env (root level)
```
BETTER_AUTH_SECRET=<openssl rand -hex 32>
MASTER_ENCRYPTION_KEY=<openssl rand -hex 32>
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/growthfin_clean
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
DEPLOY_SECRET=local-dev-stub
ENCRYPTION_KEY=<same as MASTER_ENCRYPTION_KEY>
```

## Build

```bash
bun install
bun run build    # Builds all packages then apps
```

## Architecture

- **apps/api** — ElysiaJS backend on Bun (port 3000)
- **apps/web** — React Router 7 frontend with SSR (Vite, port 5173)
- **packages/db** — Drizzle ORM schema + migrations (135 tables, 58 migrations)
- **packages/api-client** — Type-safe API client (@hey-api/client-fetch)
- **packages/js** — @signaldb-live/client (SignalDB JS SDK)
- **packages/react** — @signaldb/react (React hooks for SignalDB)
- **packages/auth** — @signaldb-live/auth (auth utilities)
- **packages/connect** — @signaldb-live/connect (SignalDB platform integration)
- **packages/connect-auth** — @signaldb-live/connect-auth (auth bridge)
- **packages/hooks-sdk** — @agios/hooks-sdk (Claude hooks SDK)
- **packages/kapable** — @agios/kapable (Kapable SDK)
- **packages/transcript-types** — @agios/transcript-types (shared types)

## What was removed (from original growthfin)

Apps: admin, ai-sink, auth, cli, hooks, loom, marketing, relay
These are either not needed or will be replaced by Kapable platform equivalents.

## Package naming

- `@agios/*` — workspace package names (NOT npm packages)
- `@signaldb-live/*` — SignalDB v1 SDK packages (will be replaced in Phase 4)
- `@signaldb/*` — SignalDB React integration

## Database Gotchas

- **Missing enums in migrations**: 6 enum types (`crm_entity_type`, `crm_lead_contactability`, `crm_blacklist_reason`, `crm_contact_disposition`, `crm_opportunity_outcome`, `crm_lost_reason`) exist in the Drizzle schema but were never generated into migration SQL. Must be created manually before running migrations.
- **Two-pass migration**: Use `packages/db/push-schema.ts` instead of `drizzle-kit push` — it categorizes statements (types → tables → alters → indexes) and handles ordering.
- **pgboss**: API uses pg-boss for job queue — requires the database to exist and be accessible.

## Known issues

- Sourcemap warnings from shadcn/ui components during web build (cosmetic, not blocking)
- Large SSR bundle (7.2 MB) — acceptable for now, optimize in Phase 5
- Optional env vars (OPENAI, Twilio, Resend, etc.) not set — CRM features degrade gracefully
- SignalDB platform routes (`deployment-api`, `bootstrap-api`) will error if called — these are legacy and will be removed in later phases
