#!/bin/sh
set -e

echo "Running database migrations..."
node scripts/migrate.mjs

echo "Starting Fuchsbau on ${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node build