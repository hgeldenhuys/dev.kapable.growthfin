---
name: discover-env
description: |
  🚨 CRITICAL: Prevents connection failures! Discovers ACTUAL ports/URLs (PostgreSQL=5439 NOT 5432, API=3000, Electric=3001).

  MUST RUN if you see: localhost, port numbers, psql, curl, database, connection strings, or ANY service URLs.

  Prevents: "FATAL: database does not exist", "connection refused", wrong ports, missing credentials.

trigger:
  - "psql"
  - "$DATABASE_URL"
  - "database"
  - "postgres"
  - "postgresql"
  - "curl.*localhost"
  - "SELECT"
  - "INSERT"
  - "UPDATE"
  - "DELETE"
  - "FROM.*todos"
  - "FROM.*hook_events"
  - "connection.*failed"
  - "FATAL.*database"
  - "port 543"
  - "port 5432"
  - "port 5439"
  - ":5432"
  - ":5439"
  - ":3000"
  - ":3001"
  - ":5173"
  - "localhost"
  - "127.0.0.1"
  - "connect to"
  - "connecting to"
  - "connection string"
  - "connection to server"
  - "could not connect"
  - "PGHOST"
  - "PGPORT"
  - "PGUSER"
  - "PGPASSWORD"
  - "PGDATABASE"
  - "API_URL"
  - "ELECTRIC_URL"
  - "default port"
  - "standard port"
  - "bun.*dev"
  - "npm.*dev"
  - "fetch.*http"
  - "todos WHERE"
  - "sessions WHERE"
  - "projects WHERE"

priority: HIGHEST

when_to_use: |
  MANDATORY before ANY:
  - psql command (even simple SELECT)
  - Database connection attempt
  - API curl command
  - $DATABASE_URL usage
  - SQL query execution
  - Service health check

  If you see "psql" in a command, STOP and run this skill FIRST!

when_NOT_to_use: |
  Only skip if you've ALREADY run it in the last 5 minutes
---

# Environment Discovery Skill

## Purpose
Discover environment configuration BEFORE making assumptions about database ports, API URLs, or service settings.

## Execution

### Step 1: Find Environment Files
```bash
# Find all env files
find . -maxdepth 3 -name ".env*" -o -name "*.env" | grep -v node_modules
```

### Step 2: Check Docker Compose (Common Source of Truth)
```bash
# Check for docker-compose.yml
if [ -f docker-compose.yml ]; then
  echo "=== Docker Compose Services ==="
  grep -A 5 "ports:" docker-compose.yml | grep -E "^[[:space:]]+-|^[[:space:]]*[a-z]"
fi
```

### Step 3: Extract Key Configuration
```bash
# Database configuration
echo "=== Database Configuration ==="
rg "DATABASE|POSTGRES|DB_" .env* 2>/dev/null || echo "No .env files found"

# API/Service URLs
echo "=== Service URLs ==="
rg "API_URL|BASE_URL|PORT" .env* 2>/dev/null

# Auth/Credentials
echo "=== Authentication ==="
rg "TOKEN|KEY|SECRET" .env* 2>/dev/null | sed 's/=.*/=***REDACTED***/'
```

### Step 4: Check Project Config
```bash
# Check if project has config documentation
if [ -f .claude/sdlc/PROJECT-CONFIG.md ]; then
  echo "=== Project Config Quick Reference ==="
  rg "database:|port:|connection:" .claude/sdlc/PROJECT-CONFIG.md -A 1
fi
```

### Step 5: Summarize Critical Info
```bash
echo "=== CRITICAL ENVIRONMENT FACTS ==="
echo "Database Port: [extracted from above]"
echo "API URL: [extracted from above]"
echo "Environment: [development/production]"
```

## Output Format

Present findings as:

```
🔍 Environment Discovery Results

DATABASE:
  Port: 5439 (NOT default 5432!)
  Connection: postgresql://postgres:***@localhost:5439/agios_dev

✅ CORRECT psql command:
psql "postgresql://postgres:postgres@localhost:5439/agios_dev" -c "YOUR_QUERY"

❌ WRONG (will fail):
psql $DATABASE_URL -c "YOUR_QUERY"  # No DATABASE_URL in shell
psql -c "YOUR_QUERY"                 # Uses wrong port 5432

API:
  URL: http://localhost:3000
  Auth: Not required for localhost

SERVICES:
  Electric: localhost:3001
  Web: localhost:5173

⚠️  CRITICAL REMINDERS:
  - ALWAYS use port 5439, NOT 5432
  - ALWAYS include full connection string
  - DATABASE_URL only exists in .env, not shell
```

## Quick Usage

```bash
# Before ANY database work
./discover-env.sh

# Then use the discovered config
psql [discovered_connection_string]
```

## Integration with SDLC

This skill should be run:
1. ✅ At session start (part of /session-init)
2. ✅ Before database migrations
3. ✅ Before API testing
4. ✅ When connection errors occur

## Common Findings

### Agios Project
- Database: Port 5439 (NOT 5432)
- API: localhost:3000 (no auth needed)
- ElectricSQL: localhost:3001

### Typical Issues Prevented
- ❌ Tried psql localhost:5432 → Failed
- ✅ Checked env first → Used 5439 → Success

## Example Invocation

```bash
User: "Check the todos table schema"

Me: [Uses discover-env skill]
    → Discovers: Database on port 5439
    → Uses correct connection immediately
    → Success on first try
```

## Why This Works

- **Fast**: <5 seconds
- **Lightweight**: <200 tokens
- **Prevents**: Wrong assumptions
- **Saves**: Minutes of trial and error

## Success Criteria

After running this skill, you should know:
- ✅ Database connection string (exact)
- ✅ All service ports
- ✅ API authentication requirements
- ✅ Environment type (dev/prod)

If you DON'T know these → Run the skill again or check PROJECT-CONFIG.md
