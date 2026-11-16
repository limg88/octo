#!/usr/bin/env bash
# Demo 31: what was put away on the page of the day is read and taken back; what goes away by
# itself is told; a signal is put off until the end of the sprint or until a day the PM writes.
# Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-31"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_today_project "$work"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Per il passo 5, in un altro terminale:
  node demo/lib/fake-tracker.ts "$work/Aurora"
Apro Octo: segui demo/31-oggi-messe-da-parte/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
