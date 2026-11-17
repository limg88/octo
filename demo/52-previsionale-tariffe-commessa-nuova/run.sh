#!/usr/bin/env bash
# Demo 52: a project that sells days moves to a new project code: the rates of the code before are
# proposed for the new one, and data of the month on a code no longer of the project are said.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-52"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node "$root/demo/lib/fake-forecast-new-code.ts" "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora (commesse PRJ000606 con tariffe, PRJ000707 nuova e senza)"
echo "Apro Octo: segui demo/52-previsionale-tariffe-commessa-nuova/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
