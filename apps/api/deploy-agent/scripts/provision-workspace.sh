#!/bin/bash
# provision-workspace.sh — Auto-provision dev workspace with org apps
# Called by orbstack-terminal.sh before tmux starts.
# Idempotent: safe to run on every session connect.
#
# Usage: provision-workspace.sh <apps-base64-json>
#
# Apps JSON format: [{ "repo", "dir", "containerName", "service", "port", "framework", "dbUrl?", "branch?" }]

set -euo pipefail

# Ensure bun is in PATH (installed to ~/.bun by default)
export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${HOME}/.local/bin:/usr/local/bin:${PATH}"

APPS_B64="${1:-W10=}"
HOME_DIR="/home/dev"
PROVISION_MARKER="${HOME_DIR}/.last-provision"
DEPLOY_KEY="${HOME_DIR}/.ssh/id_ed25519_automation"
DEPLOY_HOST="172.232.188.216"

# Decode apps JSON
APPS_JSON=$(echo "${APPS_B64}" | base64 -d 2>/dev/null || echo "[]")
APP_COUNT=$(echo "${APPS_JSON}" | jq 'length' 2>/dev/null || echo "0")

if [ "${APP_COUNT}" = "0" ]; then
  echo "[provision] No apps configured, skipping."
  date -Iseconds > "${PROVISION_MARKER}"
  exit 0
fi

echo "[provision] Provisioning ${APP_COUNT} app(s)..."

# Verify SSH deploy key exists
if [ ! -f "${DEPLOY_KEY}" ]; then
  echo "[provision] WARNING: Deploy key not found at ${DEPLOY_KEY}"
  echo "[provision] Deployment skills will not work until the key is installed."
fi

# Process each app
for i in $(seq 0 $((APP_COUNT - 1))); do
  APP=$(echo "${APPS_JSON}" | jq -r ".[$i]")
  REPO=$(echo "${APP}" | jq -r '.repo')
  DIR=$(echo "${APP}" | jq -r '.dir')
  CONTAINER=$(echo "${APP}" | jq -r '.containerName')
  SERVICE=$(echo "${APP}" | jq -r '.service')
  PORT=$(echo "${APP}" | jq -r '.port')
  FRAMEWORK=$(echo "${APP}" | jq -r '.framework')
  DB_URL=$(echo "${APP}" | jq -r '.dbUrl // empty')
  BRANCH=$(echo "${APP}" | jq -r '.branch // "main"')

  APP_DIR="${HOME_DIR}/${DIR}"

  echo "[provision] --- ${DIR} ---"

  # Clone or pull
  if [ ! -d "${APP_DIR}/.git" ]; then
    echo "[provision] Cloning ${REPO} → ${DIR}..."
    git clone --branch "${BRANCH}" --single-branch "${REPO}" "${APP_DIR}" 2>&1 | tail -3
  else
    echo "[provision] Updating ${DIR} (git pull)..."
    cd "${APP_DIR}"
    git fetch --quiet origin "${BRANCH}" 2>/dev/null || true
    git pull --quiet --ff-only origin "${BRANCH}" 2>/dev/null || echo "[provision] Pull skipped (local changes or branch mismatch)"
  fi

  # Install dependencies if needed
  if [ -f "${APP_DIR}/package.json" ]; then
    if [ ! -d "${APP_DIR}/node_modules" ] || [ ! -f "${APP_DIR}/node_modules/.cache/.bun-tag" ]; then
      echo "[provision] Installing dependencies..."
      cd "${APP_DIR}" && bun install 2>&1 | tail -5
      mkdir -p "${APP_DIR}/node_modules/.cache" && date > "${APP_DIR}/node_modules/.cache/.bun-tag"
    else
      echo "[provision] Dependencies up to date."
    fi
  fi

  # Create .env if dbUrl is provided and .env doesn't exist
  if [ -n "${DB_URL}" ] && [ ! -f "${APP_DIR}/.env" ]; then
    echo "[provision] Creating .env with DATABASE_URL..."
    echo "DATABASE_URL=${DB_URL}" > "${APP_DIR}/.env"
  fi

  # Create deploy skill
  SKILL_DIR="${APP_DIR}/.claude/skills/deploy"
  mkdir -p "${SKILL_DIR}"
  cat > "${SKILL_DIR}/SKILL.md" << SKILLEOF
---
name: deploy
description: Build and deploy ${DIR} to production
triggers: ["deploy", "push to production", "ship it"]
tools: [Bash, Read]
---

# Deploy ${DIR} to Production

Container: \`${CONTAINER}\` | Service: \`${SERVICE}\` | Port: ${PORT}

## Steps

1. **Build**:
   \`\`\`bash
   cd ${APP_DIR} && bun run build
   \`\`\`

2. **Create tarball** (excludes node_modules, .git, .env):
   \`\`\`bash
   tar czf /tmp/deploy.tar.gz --exclude=node_modules --exclude=.git --exclude=.env -C ${APP_DIR} .
   \`\`\`

3. **Upload to Linode**:
   \`\`\`bash
   scp -i ${DEPLOY_KEY} /tmp/deploy.tar.gz deploy@${DEPLOY_HOST}:/tmp/
   \`\`\`

4. **Push to container + restart**:
   \`\`\`bash
   ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} << 'EOF'
   rm -rf /tmp/app-staging && mkdir /tmp/app-staging
   tar xzf /tmp/deploy.tar.gz -C /tmp/app-staging
   incus file push -r /tmp/app-staging/ ${CONTAINER}/app/
   incus exec ${CONTAINER} -- bash -c 'cd /app && if [ -d app-staging ]; then cp -a app-staging/* . && rm -rf app-staging; fi && bun install --frozen-lockfile && systemctl restart ${SERVICE}'
   EOF
   \`\`\`

5. **Health check**:
   \`\`\`bash
   ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- curl -sf http://127.0.0.1:${PORT}/health"
   \`\`\`

6. **On failure — check logs**:
   \`\`\`bash
   ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- journalctl -u ${SERVICE} -n 30 --no-pager"
   \`\`\`
SKILLEOF

  # Create logs skill
  LOGS_DIR="${APP_DIR}/.claude/skills/logs"
  mkdir -p "${LOGS_DIR}"
  cat > "${LOGS_DIR}/SKILL.md" << SKILLEOF
---
name: logs
description: View production logs for ${DIR}
triggers: ["logs", "show logs", "check logs", "production logs"]
tools: [Bash]
---

# View Production Logs for ${DIR}

Container: \`${CONTAINER}\` | Service: \`${SERVICE}\`

## Commands

**Recent logs (last 50 lines)**:
\`\`\`bash
ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- journalctl -u ${SERVICE} -n 50 --no-pager"
\`\`\`

**Follow logs (live)**:
\`\`\`bash
ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- journalctl -u ${SERVICE} -f --no-pager"
\`\`\`

**Logs since a time period**:
\`\`\`bash
ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- journalctl -u ${SERVICE} --since '1 hour ago' --no-pager"
\`\`\`

**Service status**:
\`\`\`bash
ssh -i ${DEPLOY_KEY} deploy@${DEPLOY_HOST} "incus exec ${CONTAINER} -- systemctl status ${SERVICE}"
\`\`\`
SKILLEOF

  echo "[provision] Skills created for ${DIR}."
done

# Write provision marker
date -Iseconds > "${PROVISION_MARKER}"
echo "[provision] Done. ${APP_COUNT} app(s) provisioned."
