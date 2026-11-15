#!/usr/bin/env bash
# Demo 11: an approved status report written as slides on the deck of the PM.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-11"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node "$root/demo/lib/fake-deck.ts" "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "Presentazione del periodo scorso: $work/Aurora/Presentazioni/Stato avanzamento - periodo scorso.pptx"
echo "Apro Octo: segui demo/11-presentazione/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
