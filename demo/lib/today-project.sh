#!/usr/bin/env bash
# Creates the synthetic project «Aurora» with everything the page of the day reads: an old export
# of the tracker, hours, forecast, alignment, a fake Mail folder, and what a PM sets once.
# Usage: source demo/lib/project.sh; source demo/lib/today-project.sh; make_today_project <work folder>
make_today_project() {
  local work="$1"
  local aurora="$work/Aurora"
  make_demo_project "$work"
  # The tracker was exported five days ago: the page says its numbers are of that day.
  node demo/lib/fake-tracker.ts "$aurora" old
  node demo/lib/fake-hours.ts "$aurora"
  node demo/lib/fake-forecast.ts "$aurora" hours
  node demo/lib/fake-alignment.ts "$aurora"
  node demo/lib/fake-today.ts "$aurora" "$work/Mail"
  # What a PM sets once is already set, so that the page shows signals and not forms.
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
      // The same person under two names, as demo 08 teaches to set.
      aliases: [{ worklog: "E. Costa", timesheet: "Costa Elena" }],
    })
    set("alignment", { sprint: "Sprint 28", tags: ["Squadra"] })
  ' "$aurora" "$(ls "$aurora/dati/ore-tracker" | sed -E "s/worklog_(.*)\.csv/\1/")"
}
