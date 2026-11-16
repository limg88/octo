#!/usr/bin/env bash
# Demo 34: the dashboard read in three parts (sprint, bugs, trend), the list of bugs split by
# severity and by person with every split a filter, the way to the bug on Azure DevOps, the
# numbers compared with the start of the period, and the decisions that can be taken back.
# Synthetic project, fake Azure DevOps on this computer, already linked.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-34"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/cruscotto-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
start_cruscotto_demo "$work"

cat <<TXT
Azure DevOps finto: $OCTO_DEV_ADO_URL (organizzazione contoso, progetto Aurora, già collegato)
Apro Octo: segui demo/34-cruscotto-schede-e-bug/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
