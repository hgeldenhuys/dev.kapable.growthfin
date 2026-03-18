#!/bin/bash
#
# Provision an Enterprise Tier PostgreSQL Instance
#
# Usage: ./provision-enterprise.sh [INSTANCE_NAME] [PORT] [SERVER_HOST]
#
# Creates a dedicated PostgreSQL container for Enterprise tier.
# Each Enterprise instance serves ONE customer/project.
#
# Examples:
#   ./provision-enterprise.sh acme-corp 5450
#   ./provision-enterprise.sh customer-123 5451 172.232.188.216
#

set -e

# Configuration
INSTANCE_NAME=${1:-""}
PORT=${2:-""}
SERVER_HOST=${3:-"172.232.188.216"}
SSH_KEY="${SSH_KEY:-~/.ssh/id_ed25519_automation}"
SSH_USER="${SSH_USER:-deploy}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-signaldb_prod_encryption_k3y_2024_s3cur3_r4nd0m}"

# Validate required args
if [ -z "$INSTANCE_NAME" ]; then
    echo "Usage: $0 <instance-name> <port> [server-host]"
    echo ""
    echo "Examples:"
    echo "  $0 acme-corp 5450"
    echo "  $0 customer-123 5451 172.232.188.216"
    exit 1
fi

if [ -z "$PORT" ]; then
    echo "ERROR: Port is required"
    echo "Usage: $0 <instance-name> <port> [server-host]"
    exit 1
fi

# Container name
CONTAINER_NAME="signaldb-enterprise-${INSTANCE_NAME}"

# Generate secure password
PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')

echo "========================================"
echo "SignalDB Enterprise Instance Provisioning"
echo "========================================"
echo "Instance:  ${INSTANCE_NAME}"
echo "Container: ${CONTAINER_NAME}"
echo "Server:    ${SERVER_HOST}"
echo "Port:      ${PORT}"
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
if ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "docker ps -a --format '{{.Names}}' | grep -q '^${CONTAINER_NAME}$'" 2>/dev/null; then
    echo "ERROR: Container ${CONTAINER_NAME} already exists"
    exit 1
fi
echo "✓ Container name ${CONTAINER_NAME} is available"

# Create data directory
echo "Creating data directory..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "sudo mkdir -p /opt/signaldb/data/${CONTAINER_NAME} && sudo chown \$(id -u):\$(id -g) /opt/signaldb/data/${CONTAINER_NAME}"
echo "✓ Data directory created"

# Create PostgreSQL container (Enterprise gets more resources)
echo ""
echo "Creating PostgreSQL container..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" << EOF
docker run -d \
  --name ${CONTAINER_NAME} \
  --restart unless-stopped \
  -p 127.0.0.1:${PORT}:5432 \
  -e POSTGRES_USER=signaldb \
  -e POSTGRES_PASSWORD="${PASSWORD}" \
  -e POSTGRES_DB=postgres \
  -v /opt/signaldb/data/${CONTAINER_NAME}:/var/lib/postgresql/data \
  --memory=4g \
  --cpus=2 \
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
    STATUS=$(ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" "docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}" 2>/dev/null || echo "starting")
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

# Enable extensions
echo ""
echo "Setting up database extensions..."
ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" << EOF
docker exec ${CONTAINER_NAME} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec ${CONTAINER_NAME} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
EOF
echo "✓ Extensions enabled"

# Register in control plane database
echo ""
echo "Registering instance in control plane..."
REGISTER_SQL="INSERT INTO database_instances (
  server_id, name, container_name, port, tier,
  max_databases, postgres_user, postgres_password_encrypted, status
)
SELECT
  s.id,
  '${CONTAINER_NAME}',
  '${CONTAINER_NAME}',
  ${PORT},
  'enterprise',
  1,
  'signaldb',
  pgp_sym_encrypt('${PASSWORD}', '${ENCRYPTION_KEY}'),
  'active'
FROM servers s
WHERE s.name = 'us-east-1'
RETURNING id;"

INSTANCE_ID=$(ssh -i "${SSH_KEY}" "${SSH_USER}@${SERVER_HOST}" \
  "PGPASSWORD='signaldb_prod_secure_2024' psql -h localhost -p 5440 -U signaldb -d signaldb -t -A -c \"${REGISTER_SQL}\"" 2>/dev/null | tr -d ' \n')

if [ -z "$INSTANCE_ID" ]; then
    echo "WARNING: Could not auto-register. Manual registration required."
else
    echo "✓ Registered with ID: ${INSTANCE_ID}"
fi

echo ""
echo "========================================"
echo "✅ Enterprise Instance Provisioning Complete!"
echo "========================================"
echo ""
echo "Instance Name: ${INSTANCE_NAME}"
echo "Container:     ${CONTAINER_NAME}"
echo "Port:          ${PORT}"
echo "Instance ID:   ${INSTANCE_ID:-'(manual registration needed)'}"
echo "Password:      ${PASSWORD}"
echo ""
echo "This instance can now be assigned to a Pro tier project"
echo "via the upgrade API: POST /v1/projects/{id}/upgrade"
echo ""
echo "========================================"
