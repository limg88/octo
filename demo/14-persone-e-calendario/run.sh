#!/usr/bin/env bash
# Demo 14: people and calendar of a project, ready questions, and a new project from scratch.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-14"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node "$root/demo/lib/fake-hours.ts" "$work/Aurora"
  node "$root/demo/lib/fake-forecast.ts" "$work/Aurora" hours
  mkdir -p "$work/Nuovi progetti"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "Cartella dove creare il progetto nuovo: $work/Nuovi progetti"
echo "Apro Octo: segui demo/14-persone-e-calendario/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
