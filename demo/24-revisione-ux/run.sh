#!/usr/bin/env bash
# Demo 24: the revised interface — two themes, the day and the bugs as a list with its detail, a
# citation beside its answer, an answer that starts a deliverable — on a synthetic project, with
# a fake Mail folder and a fake Claude.
# KEEP=1 keeps the projects and the app state of a previous run.
# REAL=1 uses Claude Code on your own seat instead of the fake one.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-24"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  aurora="$work/Aurora"
  # The tracker was exported five days ago: the page says its numbers are of that day.
  node demo/lib/fake-tracker.ts "$aurora" old
  node demo/lib/fake-hours.ts "$aurora"
  node demo/lib/fake-forecast.ts "$aurora" hours
  node demo/lib/fake-alignment.ts "$aurora"
  node demo/lib/fake-today.ts "$aurora" "$work/Mail"
  # What a PM sets once is already set, so that the pages show signals and not forms.
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
  # A second project: what goes with the PM inside a project does not follow them into another.
  mkdir -p "$work/Boreale"
  printf '# Boreale\n\nIl collaudo del progetto Boreale è previsto a gennaio 2027.\n' > "$work/Boreale/stato.md"
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$aurora","addedAt":"2026-11-14T08:00:00.000Z"},
 {"id":"demo-boreale","name":"Boreale","folder":"$work/Boreale","addedAt":"2026-11-15T08:00:00.000Z"}]
JSON
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
# Demo only: a person already signed in (the sign-in is shown by demo 23), and no system keychain.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

cat <<TXT
Progetti di prova: $work/Aurora e $work/Boreale
Apro Octo: segui demo/24-revisione-ux/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
