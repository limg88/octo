#!/usr/bin/env bash
# Demo 70: an email follows how the PM addresses its recipient, and a finding of the critical
# reading is corrected alone, in its passage, with the general change proposed from the findings.
# Synthetic project, fake Mail folder, fake Claude. The meeting of the day starts in 40 minutes.
# KEEP=1 keeps the project and the app state of a previous run.
# SPRINT_FAR=1 sets the end of the sprint two weeks from now: requirements and alignment stay off.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-70"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

MEETING_IN_MINUTES=40
SPRINT_FAR_DAYS=14

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  OCTO_DEMO_MEETING_IN_MINUTES="$MEETING_IN_MINUTES" make_today_project "$work"
  if [[ "${SPRINT_FAR:-0}" == "1" ]]; then
    node -e '
      const { readFileSync, writeFileSync } = require("node:fs")
      const [file, days] = process.argv.slice(1)
      const team = JSON.parse(readFileSync(file, "utf8"))
      const day = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      team.periods = team.periods.map((period) => ({ ...period, to: day }))
      writeFileSync(file, JSON.stringify(team, null, 1))
    ' "$work/Aurora/_octo/.impostazioni/team.json" "$SPRINT_FAR_DAYS"
  fi
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/70-deliverable-tu-e-rilettura/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
