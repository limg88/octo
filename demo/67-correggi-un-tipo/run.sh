#!/usr/bin/env bash
# Demo 67: how a kind of deliverable of Octo is written is corrected in words. Claude writes the
# instructions again, the PM reads them whole, and only then they are kept, for the project.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-67"
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
echo "Apro Octo: segui demo/67-correggi-un-tipo/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
