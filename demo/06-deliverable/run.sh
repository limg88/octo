#!/usr/bin/env bash
# Demo 06: an email to the client goes from the PM's request to the approved Word file.
# REAL=1 uses Claude Code on your own seat instead of the fake model.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-06"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/06-deliverable/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
