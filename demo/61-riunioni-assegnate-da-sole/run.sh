#!/usr/bin/env bash
# Demo 61: a recorded meeting enters by itself the only project all its known people are of;
# one whose people are of two projects waits for the PM, as before.
# Two synthetic projects on the same fake folder of Verbale, fake Claude.
# KEEP=1 keeps the projects and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-61"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-moved-meetings.ts "$work"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_VERBALE_DIR="$work/VerbaleDati"
# Demo only: a person already signed in, and no system keychain.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetti di prova: $work/Aurora e $work/Boreale, stessa cartella di Verbale ($work/Verbale)
Una daily con le sole persone di Aurora e una riunione con persone dei due progetti aspettano di essere lette.
Apro Octo: segui demo/61-riunioni-assegnate-da-sole/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
