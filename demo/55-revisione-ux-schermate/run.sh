#!/usr/bin/env bash
# Demo 55: the review of the screens — the tab in use underlined, the same wait in every section,
# tables of figures aligned as one, four open points on entering «Oggi», the frequent commands
# before the lists they act on, one warning for the states read in two ways, calm tones for what
# is foreseen. Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Demo 56 shows other screens of the same project: it runs this script under its own name.
name="${DEMO_NAME:-55-revisione-ux-schermate}"
work="$root/.tmp/demo-${name%%-*}"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  aurora="$work/Aurora"
  node demo/lib/fake-tracker.ts "$aurora" old
  node demo/lib/fake-hours.ts "$aurora"
  node demo/lib/fake-forecast.ts "$aurora" hours
  node demo/lib/fake-alignment.ts "$aurora"
  node demo/lib/fake-progress.ts "$aurora"
  node demo/lib/fake-today.ts "$aurora" "$work/Mail"
  node demo/lib/fake-points.ts "$aurora"
  node -e '
    const { readFileSync, writeFileSync, existsSync } = require("node:fs")
    const [folder, month] = process.argv.slice(1)
    const set = (name, values) => {
      const file = `${folder}/_octo/.impostazioni/${name}.json`
      const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
      writeFileSync(file, JSON.stringify({ ...saved, ...values }, null, 1))
    }
    set("forecast", { modelPath: "Amministrazione/Previsionale avanzamenti.xlsx" })
    set("dashboard", {
      exportPath: "dati/tracker/export.json",
      historyPath: "dati/tracker/cronologia.json",
      tags: ["Squadra"],
      requirementPeriods: ["R2"],
    })
    set("hours", {
      timesheetPath: "dati/Timesheets",
      worklogPath: `dati/ore-tracker/worklog_${month}.csv`,
      projects: ["PRJ000101"],
      aliases: [{ worklog: "E. Costa", timesheet: "Costa Elena" }],
    })
    set("alignment", { sprint: "Sprint 28", tags: ["Squadra"] })
  ' "$aurora" "$(ls "$aurora/dati/ore-tracker" | sed -E "s/worklog_(.*)\.csv/\1/")"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/$name/COPIONE.md. Chiudi la finestra per finire.
TXT
if [[ "${SETUP_ONLY:-0}" == "1" ]]; then exit 0; fi
pnpm --filter @octo/desktop exec electron .
