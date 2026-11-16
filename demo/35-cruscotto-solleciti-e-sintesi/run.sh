#!/usr/bin/env bash
# Demo 35: the items whose last comment waits for an answer, with a reminder Claude drafts on
# request; the comment of Claude on the numbers of a period, checked by the code; the tracker
# read again by itself. Synthetic project, fake Azure DevOps already linked, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
# NO_CLAUDE=1 runs as on a computer without Claude Code. REAL=1 uses Claude Code on your seat.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-35"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/cruscotto-project.sh"

# Demo only: the sources are read every 30 seconds instead of every quarter of an hour.
SYNC_SECONDS=30

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
start_cruscotto_demo "$work"
export OCTO_DEV_SYNC_SECONDS="$SYNC_SECONDS"

cat <<TXT
Azure DevOps finto: $OCTO_DEV_ADO_URL (già collegato; le fonti si rileggono ogni $SYNC_SECONDS secondi)
Per far comparire un bug nuovo sul tracker:  kill -USR1 \$(cat .tmp/demo-35/ado.pid)
Apro Octo: segui demo/35-cruscotto-solleciti-e-sintesi/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
