#!/usr/bin/env bash
# Demo 53: the page of the monthly forecast made readable (name of the code, ordered amount,
# days and progress apart, total of the project, mark of incomplete data) and three small
# corrections: decimal comma, name and surname in «Ore», a state read two ways.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-53"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
node demo/53-previsionale-pagina-e-minori/minori.ts
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node "$root/demo/lib/fake-forecast-new-code.ts" "$work/Aurora" worklog
fi

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo
echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/53-previsionale-pagina-e-minori/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
