#!/bin/bash
set -e
cd /app/apps/api
if [ -f /app/.env ]; then
  set -a
  source /app/.env
  set +a
fi
if [ -f /app/apps/api/.env ]; then
  set -a
  source /app/apps/api/.env
  set +a
fi
export PORT=3000
exec /usr/local/bin/bun src/index.ts
