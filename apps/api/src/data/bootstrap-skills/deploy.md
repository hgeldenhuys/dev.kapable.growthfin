# /deploy — Deploy to SignalDB

Deploy the current app to its SignalDB Connect environment.

## How It Works

1. Commits and pushes your changes to git
2. Triggers a deploy via the SignalDB API
3. Polls deployment status until complete

## Prerequisites

Your `.env` must contain (set automatically by the bootstrap setup):
- `SIGNALDB_PLATFORM_KEY` — API authentication
- `SIGNALDB_APP_ID` — Target app UUID
- `SIGNALDB_ENV_NAME` — Target environment (e.g., `prod`, `dev`)
- `SIGNALDB_API_URL` — API base URL (https://api.signaldb.live)

## Process

### Step 1: Check for uncommitted changes

```bash
git status --porcelain
```

If there are changes, ask the user if they want to commit and push first.

### Step 2: Commit and push (if needed)

```bash
git add -A
git commit -m "<descriptive message>"
git push origin HEAD
```

### Step 3: Load deploy config from .env

Read the `.env` file to get `SIGNALDB_PLATFORM_KEY`, `SIGNALDB_APP_ID`, `SIGNALDB_ENV_NAME`, and `SIGNALDB_API_URL`.

```bash
# Source the env file to get deploy vars
source .env
echo "Deploying $SIGNALDB_APP_SLUG to $SIGNALDB_ENV_NAME..."
```

### Step 4: Trigger deploy

```bash
curl -s -X POST \
  "${SIGNALDB_API_URL}/v1/apps/${SIGNALDB_APP_ID}/environments/${SIGNALDB_ENV_NAME}/deploy" \
  -H "Authorization: Bearer ${SIGNALDB_PLATFORM_KEY}" \
  -H "Content-Type: application/json"
```

The response includes a deployment ID:
```json
{"id": "...", "status": "pending", ...}
```

### Step 5: Poll deployment status

Poll every 5 seconds until status is `running` or `failed`:

```bash
curl -s \
  "${SIGNALDB_API_URL}/v1/apps/${SIGNALDB_APP_ID}/environments/${SIGNALDB_ENV_NAME}/status" \
  -H "Authorization: Bearer ${SIGNALDB_PLATFORM_KEY}"
```

### Step 6: Report result

On success:
```
Deploy complete! App is live at https://<subdomain>.signaldb.app
```

On failure, fetch logs:
```bash
curl -s \
  "${SIGNALDB_API_URL}/v1/apps/${SIGNALDB_APP_ID}/environments/${SIGNALDB_ENV_NAME}/logs" \
  -H "Authorization: Bearer ${SIGNALDB_PLATFORM_KEY}"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" | Check `SIGNALDB_PLATFORM_KEY` in `.env` |
| "Deployment already in progress" | Wait for current deploy or check Console |
| Build fails | Check logs output, fix code, redeploy |
| "App not found" | Verify `SIGNALDB_APP_ID` matches your app |

## Notes

- Deploys pull from your git remote, so always push before deploying
- The platform does `git pull` + `bun install` + `bun run build` + restart
- Deploy typically takes 30-90 seconds depending on build complexity
- You can also deploy from the SignalDB Console UI
