#!/usr/bin/env bash
# Demo 54: the sections follow the kind of project: no «Allineamento» with one tracker, and the
# «Avanzamento» of a fixed price is what NetSuite says of its invoices, with no form of the client.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-54"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
# The fake NetSuite is a database of the test Postgres (Docker).
pnpm db:setup >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

mode="lifetime"
node demo/lib/fake-dwsi-months.ts "$work/Aurora" "$work/dati" $mode > "$work/dwsi.name" &
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

echo "NetSuite finto: database $(cat "$work/dwsi.name") su 127.0.0.1:5460, commessa PRJ000101 a corpo (7.500), timesheet di due mesi"
echo "Fatturato 30%, ricavi riconosciuti 70%; una persona senza timesheet dichiarata dal PM."
echo "Apro Octo: segui demo/54-navigazione-per-tipo/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
