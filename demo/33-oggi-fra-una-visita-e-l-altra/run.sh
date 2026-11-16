#!/usr/bin/env bash
# Demo 33: between a look at the page of the day and the next — what is new is marked, the
# sidebar counts what waits, the page says when the sources are read next, and the system tells
# when a signal comes first.
# Synthetic project, fake Mail folder, fake Claude. The sources are read every minute instead of
# every quarter of an hour, and the meeting of the day starts in a little more than two hours:
# after two or three readings it comes first, and the system says so.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-33"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

SYNC_SECONDS=60
MEETING_IN_MINUTES=122

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  OCTO_DEMO_MEETING_IN_MINUTES="$MEETING_IN_MINUTES" make_today_project "$work"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
export OCTO_DEV_SYNC_SECONDS="$SYNC_SECONDS"

cat <<TXT
Progetto di prova: $work/Aurora
Per il passo 3, in un altro terminale:
  node demo/lib/fake-mail-turns.ts "$work/Mail"
Apro Octo: segui demo/33-oggi-fra-una-visita-e-l-altra/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
