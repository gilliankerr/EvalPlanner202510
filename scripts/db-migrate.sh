#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$PROJECT_ROOT/db/schema.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Schema file not found at $SCHEMA_FILE" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Please export it or add it to .env." >&2
  exit 1
fi

echo "Waiting for database to be available..."
# Allow override of retry/backoff behavior via env vars (defaults kept for backward compatibility)
RETRY=0
MAX_RETRIES=${DB_MIGRATE_MAX_RETRIES:-12}
SLEEP_SECONDS=${DB_MIGRATE_SLEEP_SECONDS:-5}
until psql "$DATABASE_URL" -c '\q' >/dev/null 2>&1; do
  RETRY=$((RETRY+1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "Database did not become available after $((MAX_RETRIES*SLEEP_SECONDS)) seconds" >&2
    exit 1
  fi
  echo "Database not ready, retrying in $SLEEP_SECONDS seconds... ($RETRY/$MAX_RETRIES)"
  sleep $SLEEP_SECONDS
done

echo "Acquiring advisory lock for migrations..."
# Use a Postgres advisory lock to prevent concurrent migrations. The lock key can be customized
# via DB_MIGRATE_ADVISORY_LOCK (should be a 64-bit signed integer). Default is 1234567890.
LOCK_KEY=${DB_MIGRATE_ADVISORY_LOCK:-1234567890}
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<PSQL
DO $$
BEGIN
  -- Try to acquire a session-level advisory lock (bigint key) - block until acquired
  PERFORM pg_advisory_lock($LOCK_KEY);
END$$;
PSQL

echo "Applying schema migrations from $SCHEMA_FILE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

echo "Releasing advisory lock"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<PSQL
DO $$
BEGIN
  PERFORM pg_advisory_unlock($LOCK_KEY);
END$$;
PSQL
