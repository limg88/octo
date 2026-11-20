#!/usr/bin/env bash
# Demo 82: the dashboard after the interface review. The parts first, then one row with the
# period as one control, the state of the reading and the commands; the counts of the bugs as
# one band; a bug a row; a chart told by shape, in the greys of the page.
# Synthetic project, fake Azure DevOps on this computer, already linked.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-82"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/cruscotto-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
start_cruscotto_demo "$work"

cat <<TXT
Azure DevOps finto: $OCTO_DEV_ADO_URL (organizzazione contoso, progetto Aurora, già collegato)
Apro Octo: segui demo/82-cruscotto-rivisto/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
