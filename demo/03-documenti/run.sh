#!/usr/bin/env bash
# Demo 03: Word and Excel files of a project become text the agent can search and quote.
# REAL=1 uses Claude Code on your own seat for the questions.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-03"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-documents.ts "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora (un'offerta in Word e un foglio Excel in Documenti/)"
echo "Per modificare l'offerta: node demo/lib/fake-documents.ts \"$work/Aurora\" changed"
echo "Apro Octo: segui demo/03-documenti/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
