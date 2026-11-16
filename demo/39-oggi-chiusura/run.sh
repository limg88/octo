#!/usr/bin/env bash
# Demo 39: the closing of the day — Claude reads the meeting recorded today, a point is closed
# only on words the code finds in the report, one stays in the queue with what was said, a new
# one is opened, and a meeting held without a recording becomes a question to the PM.
# Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-39"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_today_project "$work"
  node demo/lib/fake-agenda.ts "$work/Mail"
  node demo/lib/fake-points.ts "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Per il passo 3, in un altro terminale:
  node demo/lib/fake-recorded.ts "$work/Aurora"
Apro Octo: segui demo/39-oggi-chiusura/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
