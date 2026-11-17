#!/usr/bin/env bash
# Demo 47: a meeting assigned to the wrong project is moved to its own, with the open points that
# came from it; a meeting whose people are of another project says so before it is assigned.
# Two synthetic projects on the same fake folder of Verbale, fake Claude.
# KEEP=1 keeps the projects and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-47"
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
Le due daily di Aurora sono finite in Boreale, con 4 punti aperti.
Apro Octo: segui demo/47-riunioni-sposta/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
