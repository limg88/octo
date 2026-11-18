#!/usr/bin/env bash
# Demo 71: a file is attached to a conversation of «Chiedi» and read by who answers, and the
# option «Con calcoli» says what it does, beside the button that asks.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-71"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
# Demo only: a person is already signed in, Claude is fake.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetto di prova: $work/Aurora"
echo "Apro Octo: segui demo/71-chiedi-allega/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
