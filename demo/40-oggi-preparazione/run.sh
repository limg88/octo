#!/usr/bin/env bash
# Demo 40: the card of preparation of a meeting — the open points to bring, what the last time
# left, the mail of who is invited, what Claude adds with its sources, and the notice of the
# system a quarter of an hour before.
# Synthetic project, fake Mail folder, fake Claude. The meeting of the day starts in seventeen
# minutes and the sources are read every minute, so the notice comes about two minutes in.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-40"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

SYNC_SECONDS=60
MEETING_IN_MINUTES=17

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  OCTO_DEMO_MEETING_IN_MINUTES="$MEETING_IN_MINUTES" make_today_project "$work"
  node demo/lib/fake-prep.ts "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
export OCTO_DEV_SYNC_SECONDS="$SYNC_SECONDS"

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/40-oggi-preparazione/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
