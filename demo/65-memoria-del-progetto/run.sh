#!/usr/bin/env bash
# Demo 65: pages of memory written by Claude, approved by the PM, read first by «Chiedi».
# REAL=1 uses Claude Code on your own seat instead of the fake model.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-65"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
# KEEP=1 keeps the project and the history of a previous run.
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/65-memoria-del-progetto/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
