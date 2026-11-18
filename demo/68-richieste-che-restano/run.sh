#!/usr/bin/env bash
# Demo 68: what the trial from zero found broken. A request to Claude goes on while the PM is in
# another section and is there at the return; «Commessa» says month by month what it reads when a
# year of timesheets misses; a thing of «Adesso» opens under its row.
# Synthetic project, fake Mail folder, fake Claude that takes its time, fake NetSuite that is slow.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-68"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

MEETING_IN_MINUTES=40

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
# The fake NetSuite is a database of the test Postgres (Docker).
pnpm db:setup >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  OCTO_DEMO_MEETING_IN_MINUTES="$MEETING_IN_MINUTES" make_today_project "$work"
fi

node demo/lib/fake-dwsi-months.ts "$work/Aurora" "$work/dati" year > "$work/dwsi.name" &
dwsi_pid=$!
trap 'kill "$dwsi_pid" 2>/dev/null || true; wait "$dwsi_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 100); do [[ -s "$work/dwsi.name" ]] && break; sleep 0.1; done
[[ -s "$work/dwsi.name" ]] || { echo "Il NetSuite finto non è partito: serve Docker (pnpm db:setup)." >&2; exit 1; }

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEV_WAREHOUSE_LOOPBACK=1
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "NetSuite finto e lento: commessa PRJ000101 iniziata dodici mesi fa, un solo mese di timesheet già letto."
echo "Apro Octo: segui demo/68-richieste-che-restano/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
