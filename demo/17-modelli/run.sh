#!/usr/bin/env bash
# Demo 17: the model that answers, writes and reads again is chosen per project, and is recorded.
# REAL=1 uses Claude Code on your own seat, so the names are those of the real models.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-17"
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

echo "Apro Octo: segui demo/17-modelli/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
