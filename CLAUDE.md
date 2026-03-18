# GrowthFin CRM

## What is this?

GrowthFin is a CRM application being migrated from SignalDB v1 to the Kapable platform.
Source: `/Users/hgeldenhuys/WebstormProjects/growthfin/`
Migration plan: `docs/plans/2026-03-18-growthfin-migration.md` (in parent kapable repo)

## Current Status: Phase 1 Complete (Scaffold)

The api + web apps and all 10 packages have been copied from growthfin and build cleanly.

### Phase roadmap
- **Phase 1** (DONE): Scaffold — copy api + web, get building
- **Phase 2**: Register as Kapable App, configure deploy pipeline
- **Phase 3**: Replace SignalDB auth with Kapable auth
- **Phase 4**: Migrate data layer from Drizzle/direct-DB to Kapable Data API
- **Phase 5**: Replace channels/providers with Kapable platform services

## Build

```bash
bun install
bun run build    # Builds all packages then apps
bun run dev      # Dev servers for api + web
```

## Architecture

- **apps/api** — ElysiaJS backend on Bun (port 3001)
- **apps/web** — React Router 7 frontend with SSR (Vite)
- **packages/db** — Drizzle ORM schema + migrations
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

## Known issues

- Sourcemap warnings from shadcn/ui components during web build (cosmetic, not blocking)
- Large SSR bundle (7.2 MB) — acceptable for now, optimize in Phase 5
