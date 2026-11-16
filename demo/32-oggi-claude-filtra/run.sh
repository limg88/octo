#!/usr/bin/env bash
# Demo 32: Claude tells the mail that asks nothing of the PM from the mail that waits, and the page
# keeps it away with the reason; Claude says why what comes first matters, the code chooses it.
# Synthetic project, fake Mail folder, fake Claude. The meeting of the day starts in 40 minutes.
# KEEP=1 keeps the project and the app state of a previous run.
# NO_CLAUDE=1 runs as on a computer without Claude Code: nothing is taken off the page.
# REAL=1 uses Claude Code on your own seat instead of the fake one.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-32"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

MEETING_IN_MINUTES=40

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  OCTO_DEMO_MEETING_IN_MINUTES="$MEETING_IN_MINUTES" make_today_project "$work"
  node demo/lib/fake-mail-noise.ts "$work/Mail"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${NO_CLAUDE:-0}" == "1" ]]; then
  export OCTO_CLAUDE_PATH="$work/claude-che-non-c-e"
elif [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/32-oggi-claude-filtra/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
