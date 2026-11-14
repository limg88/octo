#!/usr/bin/env bash
# Starts the test Postgres and writes its address in .env.local, where the DWSI tests read it.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker compose up -d --wait test-db
url='postgres://octo_owner:octo-test-only@127.0.0.1:5460/octo_test'
touch .env.local
grep -v '^DATABASE_OWNER_URL=' .env.local > .env.local.tmp || true
echo "DATABASE_OWNER_URL=$url" >> .env.local.tmp
mv .env.local.tmp .env.local
chmod 600 .env.local
echo "Test database ready on 127.0.0.1:5460 (DATABASE_OWNER_URL written to .env.local)"
