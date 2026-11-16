#!/usr/bin/env bash
# Demo 27: conversations in «Chiedi» that remember what was asked, a template for each kind of
# deliverable, and the order compared with what the company system billed. Synthetic project,
# fake Claude, fake invoices of NetSuite.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-27"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  aurora="$work/Aurora"
  node demo/lib/fake-progress.ts "$aurora"
  node demo/lib/fake-invoices.ts "$aurora"
  node demo/lib/fake-template.ts "$aurora"
  node demo/lib/fake-deck.ts "$aurora"
  # Two questions asked before there were conversations: they are kept together.
  mkdir -p "$aurora/_octo/.cronologia"
  cat > "$aurora/_octo/.cronologia/domande.json" <<JSON
[{"id":"q-vecchia-1","projectId":"demo-aurora","question":"Quanto budget resta?","askedAt":"2026-11-10T09:00:00.000Z","durationMs":4000,"answer":{"text":"Il budget residuo è di 14.500 euro [1].","citations":[{"n":1,"path":"wiki/stato.md","quote":"Il budget residuo è di 14.500 euro","status":"verified","modifiedAt":null}],"missing":[],"markersWithoutCitation":[]},"error":null},
 {"id":"q-vecchia-2","projectId":"demo-aurora","question":"Chi approva il collaudo?","askedAt":"2026-11-11T09:00:00.000Z","durationMs":4000,"answer":null,"error":"agent_failed"}]
JSON
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Modello Word:        $work/Aurora/Modelli/Nota di rilascio - modello.docx
Apro Octo: segui demo/27-chat-modelli-avanzamento/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
