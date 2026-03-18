#!/bin/bash
#
# Provision a Pro Tier PostgreSQL Pool
#
# Usage: ./provision-pro-pool.sh [SERVER_HOST] [PORT] [POOL_NAME]
#
# Creates a new PostgreSQL container for Pro tier projects.
# Each Pro project gets its own database within this shared pool.
#

set -e

# Configuration
SERVER_HOST=${1:-"172.232.188.216"}
PORT=${2:-5441}
POOL_NAME=${3:-"signaldb-pro-pool"}
SSH_KEY="${SSH_KEY:-~/.ssh/id_ed25519_automation}"
SSH_USER="${SSH_USER:-deploy}"

# Generate secure password
PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')

echo "========================================"
echo "SignalDB Pro Pool Provisioning"
echo "========================================"
echo "Server:    ${SERVER_HOST}"
echo "Port:      ${PORT}"
echo "Pool Name: ${POOL_NAME}"
echo "========================================"
echo ""

# Check SSH connectivity
echo "Checking SSH connectivity..."
if ! ssh -i "${SSH_KEY}" -o ConnectTimeout=5 "${SSH_USER}@${SERVER_HOST}" 'echo OK' >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to server ${SERVER_HOST}"
    exit 1
fi
echo "✓ SSH connection OK"

# Check if port is available
echo "Checking if port ${PORT} is available..."
if ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "netstat -tuln | grep -q ':${PORT} '" 2>/dev/null; then
    echo "ERROR: Port ${PORT} is already in use"
    exit 1
fi
echo "✓ Port ${PORT} is available"

# Check if container name exists
echo "Checking if container name is available..."
if ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "docker ps -a --format '{{.Names}}' | grep -q '^${POOL_NAME}$'" 2>/dev/null; then
    echo "ERROR: Container ${POOL_NAME} already exists"
    exit 1
fi
echo "✓ Container name ${POOL_NAME} is available"

# Create data directory
echo "Creating data directory..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "sudo mkdir -p /opt/signaldb/data/${POOL_NAME} && sudo chown \$(id -u):\$(id -g) /opt/signaldb/data/${POOL_NAME}"
echo "✓ Data directory created"

# Create PostgreSQL container
echo ""
echo "Creating PostgreSQL container..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" << EOF
docker run -d \
  --name ${POOL_NAME} \
  --restart unless-stopped \
  -p 127.0.0.1:${PORT}:5432 \
  -e POSTGRES_USER=signaldb \
  -e POSTGRES_PASSWORD="${PASSWORD}" \
  -e POSTGRES_DB=postgres \
  -v /opt/signaldb/data/${POOL_NAME}:/var/lib/postgresql/data \
  --memory=2g \
  --cpus=1 \
  --health-cmd="pg_isready -U signaldb" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=3 \
  postgres:16-alpine
EOF
echo "✓ Container created"

# Wait for PostgreSQL to be healthy
echo ""
echo "Waiting for PostgreSQL to become healthy..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    STATUS=$(ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "docker inspect --format='{{.State.Health.Status}}' ${POOL_NAME}" 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo "  Status: ${STATUS} (${WAITED}s)"
done

if [ "$STATUS" != "healthy" ]; then
    echo "ERROR: PostgreSQL did not become healthy within ${MAX_WAIT}s"
    exit 1
fi
echo "✓ PostgreSQL is healthy"

# Create template database with triggers
echo ""
echo "Setting up database templates..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" << EOF
docker exec ${POOL_NAME} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec ${POOL_NAME} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
EOF
echo "✓ Extensions enabled"

echo ""
echo "========================================"
echo "✅ Pro Pool Provisioning Complete!"
echo "========================================"
echo ""
echo "Container: ${POOL_NAME}"
echo "Port:      ${PORT}"
echo "Password:  ${PASSWORD}"
echo ""
echo "Register in database with this SQL:"
echo ""
echo "INSERT INTO database_instances ("
echo "  server_id, name, container_name, port, tier,"
echo "  max_databases, postgres_user, postgres_password_encrypted"
echo ")"
echo "SELECT"
echo "  s.id,"
echo "  '${POOL_NAME}',"
echo "  '${POOL_NAME}',"
echo "  ${PORT},"
echo "  'pro',"
echo "  100,"
echo "  'signaldb',"
echo "  pgp_sym_encrypt('${PASSWORD}', current_setting('app.encryption_key'))"
echo "FROM servers s"
echo "WHERE s.name = 'us-east-1';"
echo ""
echo "========================================"
