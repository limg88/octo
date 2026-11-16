#!/usr/bin/env bash
# Demo 38: the critical things of the week — what is to put right now and what a day of the
# week brings, by date; a risk takes a day and a weight.
# Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-38"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_today_project "$work"
  node demo/lib/fake-agenda.ts "$work/Mail"
  node demo/lib/fake-points.ts "$work/Aurora"
  node demo/lib/fake-week.ts "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/38-oggi-settimana/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
