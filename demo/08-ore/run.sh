#!/usr/bin/env bash
# Demo 08: timesheet hours against the hours logged on the tracker, from exports in the project.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-08"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi
node "$root/demo/lib/fake-hours.ts" "$work/Aurora"

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/08-ore/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
