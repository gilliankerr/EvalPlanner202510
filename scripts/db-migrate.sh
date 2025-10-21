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

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
