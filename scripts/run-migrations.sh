#!/usr/bin/env bash
set -euo pipefail

# Simple migration runner using psql
# Requires DATABASE_URL to be set (e.g., postgres://user:pass@host:port/dbname)

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

MIG_DIR="$(cd "$(dirname "$0")/.." && pwd)/migrations"

if [[ ! -d "$MIG_DIR" ]]; then
  echo "ERROR: migrations directory not found: $MIG_DIR"
  exit 1
fi

# Run *.up.sql files in lexicographic order
for file in $(ls "$MIG_DIR"/*.up.sql 2>/dev/null | sort); do
  echo "Applying migration: $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  echo "Applied: $file"
done

echo "All migrations applied."