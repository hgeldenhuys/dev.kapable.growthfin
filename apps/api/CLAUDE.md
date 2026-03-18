# SignalDB API - Claude Code Instructions

## Architecture

- **Runtime:** Bun
- **Framework:** Custom HTTP router
- **Container:** `app-platform` Incus container (10.34.154.209)
- **Port:** 3003
- **Domain:** api.signaldb.live

## Critical Rules

### Process Management
- **All services use systemd** — PM2 is NOT used anywhere in SignalDB
- Platform services run inside the `app-platform` Incus container
- Connect apps run in their own Incus containers (container mode) or as host systemd services (legacy systemd mode)
- Restart: `incus exec app-platform -- systemctl restart signaldb-api`
- Logs: `incus exec app-platform -- journalctl -u signaldb-api -n 50 --no-pager`

### Container Infrastructure
- **Incus + ZFS** — Docker was removed from the host (Feb 2026)
- Database containers: `pg-hobbyist` (10.34.154.210), `pg-pro` (10.34.154.178), `pg-enterprise-demo` (10.34.154.165)
- Port forwarding via socat systemd services (NOT Incus proxy devices)
- DB queries: `incus exec pg-hobbyist -- sudo -u postgres psql -d signaldb`

### Port Assignments

| Port | Service | Domain |
|------|---------|--------|
| 3003 | signaldb-api | api.signaldb.live |
| 3005 | signaldb-admin | console.signaldb.app |
| 3009 | signaldb-auth | auth.signaldb.app |
| 3015 | signaldb-forge-daemon | (internal) |
| 4100 | signaldb-deploy-agent | (internal) |

### Domain Architecture

| Domain | Purpose |
|--------|---------|
| `api.signaldb.live` | REST API + SSE |
| `console.signaldb.app` | Admin/Console dashboard |
| `auth.signaldb.app` | Authentication service |
| `*.signaldb.app` | Connect apps (org subdomains) |

### SSL & Proxy
- Cloudflare handles SSL for `*.signaldb.live` and `*.signaldb.app`
- Nginx on host listens port 80, proxies to containers
- Traffic: `Browser -> HTTPS -> Cloudflare -> HTTP -> Nginx :80 -> Container`

### Database Architecture

| Port | Incus Container | Tier | Isolation |
|------|----------------|------|-----------|
| 5440 | pg-hobbyist | Hobbyist | Schema-per-project |
| 5441 | pg-pro | Pro | Database-per-project |
| 5450 | pg-enterprise-demo | Enterprise | Instance-per-project |

### Tier-Aware Query Patterns (CRITICAL)

Different tiers use different isolation models:

| Tier | Isolation | Table Access Pattern |
|------|-----------|---------------------|
| Hobbyist | Schema | `{schema}._data`, `{schema}._tables` |
| Pro | Database | `_data`, `_tables` (dedicated database) |
| Enterprise | Instance | `_data`, `_tables` (dedicated PostgreSQL) |

```typescript
const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);
const useSchema = tier === 'hobbyist' && schema;

if (useSchema) {
  result = await projectSql`SELECT * FROM ${projectSql(schema)}._data WHERE ...`;
} else {
  result = await projectSql`SELECT * FROM _data WHERE ...`;
}
```

### Nginx Config
- Location: `/etc/nginx/sites-available/signaldb`
- **NEVER use global sed replacements** on nginx config — edit specific lines or rewrite file

### Encryption
- `pgp_sym_encrypt`/`pgp_sym_decrypt` for connection passwords
- Use `decode($1, 'hex')` NOT `$1::bytea` for parameters

## Build & Deploy

```bash
# Build (local)
cd apps/api && bun run build

# Deploy to server
scp -i ~/.ssh/id_ed25519_automation -r src deploy@172.232.188.216:/opt/signaldb/apps/api/
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 \
  'incus exec app-platform -- systemctl restart signaldb-api'

# Verify
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 \
  'incus exec app-platform -- systemctl status signaldb-api --no-pager'
```

## SSH Access

```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216
```

## Retrospective: Pro Tier Implementation (January 2026)

### What Went Wrong

1. **Web Server Assumption (Caddy vs Nginx)** — Always verify: `ps aux | grep -E 'nginx|caddy|apache'`
2. **Encryption Key Mismatch** — Verify what key was used to encrypt, not just what's configured
3. **bcrypt Hash Regeneration** — When auth fails, verify the hash itself first
4. **pg_dump Version Mismatch** — Always match `pg_dump --version` to server version
5. **Shell Escaping in SQL** — For complex SQL, write to temp file and use `psql -f`
6. **Tier-Aware Query Patterns** — Different tiers have different isolation models (see above)

### Validated Assumptions Checklist

Before making infrastructure changes, verify:

- [ ] Web server type: `ps aux | grep -E 'nginx|caddy|apache'`
- [ ] Web server config: `/etc/nginx/sites-available/`
- [ ] PostgreSQL version: `psql --version` and server version
- [ ] Port assignments: `ss -tlnp`
- [ ] Service status: `incus exec app-platform -- systemctl status signaldb-api`
