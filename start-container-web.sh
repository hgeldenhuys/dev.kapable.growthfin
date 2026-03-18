#!/bin/bash
set -e
cd /app/apps/web
if [ -f /app/.env ]; then
  set -a
  source /app/.env
  set +a
fi
if [ -f /app/apps/web/.env ]; then
  set -a
  source /app/apps/web/.env
  set +a
fi
export PORT=3000
exec /app/apps/web/node_modules/.bin/react-router-serve ./build/server/index.js
