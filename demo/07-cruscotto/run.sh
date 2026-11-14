#!/usr/bin/env bash
# Demo 07: the dashboard of bugs and requirements, computed from a tracker export in the project.
# OLD=1 dates the export five days ago, to show the warning on old data.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-07"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi
if [[ "${OLD:-0}" == "1" ]]; then
  node "$root/demo/lib/fake-tracker.ts" "$work/Aurora" old
else
  node "$root/demo/lib/fake-tracker.ts" "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/07-cruscotto/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
