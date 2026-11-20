#!/usr/bin/env bash
# Demo 81: «Commessa» after the interface review. Five figures in one band with the variance
# from NetSuite, the others in a table that says where each comes from, the hours as two rows
# to read, the data the PM adds to the forecast under the row of the code.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-81"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
# The fake NetSuite is a database of the test Postgres (Docker).
pnpm db:setup >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

node demo/lib/fake-dwsi-months.ts "$work/Aurora" "$work/dati" summary > "$work/dwsi.name" &
dwsi_pid=$!
trap 'kill "$dwsi_pid" 2>/dev/null || true; wait "$dwsi_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 100); do [[ -s "$work/dwsi.name" ]] && break; sleep 0.1; done
[[ -s "$work/dwsi.name" ]] || { echo "Il NetSuite finto non è partito: serve Docker (pnpm db:setup)." >&2; exit 1; }

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail-assente"
# Demo only: the fake warehouse is on this computer, and its password is kept without the keychain.
export OCTO_DEV_WAREHOUSE_LOOPBACK=1
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "NetSuite finto: database $(cat "$work/dwsi.name") su 127.0.0.1:5460, commessa PRJ000101 a corpo (7.500)"
echo "Apro Octo: segui demo/81-commessa-rivista/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
