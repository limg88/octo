#!/usr/bin/env bash
# Demo 26: the fixes to the interface — Claude Code found through the PATH of the terminal, tables
# that sort and filter with their columns in place, the settings of «Oggi» among the settings, the
# forecast with what is computed apart from what is typed, tags chosen in a list that is searched.
# Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-26"
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
  node demo/lib/fake-today.ts "$aurora" "$work/Mail"
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
    // A tracker with many tags, as a real one has: one for each release.
    const sprint = `${folder}/dati/tracker/sprint.json`
    const exported = JSON.parse(readFileSync(sprint, "utf8"))
    const releases = Array.from({ length: 30 }, (_unused, at) => `3.${at}.0`)
    exported.items[exported.items.length - 1].tags = ["Altri", ...releases].join("; ")
    writeFileSync(sprint, JSON.stringify(exported, null, 1))
  ' "$aurora" "$(ls "$aurora/dati/ore-tracker" | sed -E "s/worklog_(.*)\.csv/\1/")"
  # Claude Code installed where only the profile of the shell knows: as with a Node version
  # manager. Octo is not told where it is.
  mkdir -p "$work/bin" "$work/zsh" "$work/node"
  ln -sf "$root/demo/lib/fake-claude" "$work/bin/claude"
  # Node alone in its folder: on this computer the real Claude Code may sit beside the real one.
  ln -sf "$(command -v node)" "$work/node/node"
  printf 'export PATH="%s:$PATH"\n' "$work/bin" > "$work/zsh/.zshrc"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
# The app starts as from the Finder: with the bare PATH of the system, plus Node for the fake.
electron="$(pnpm --filter @octo/desktop exec node -e 'process.stdout.write(require("electron"))')"
bare_path="$work/node:/usr/bin:/bin"
if [[ "${NO_SHELL:-0}" == "1" ]]; then
  # What happened before the fix: nothing tells Octo where Claude Code is.
  shell_home="$work/zsh-vuota"
  mkdir -p "$shell_home"
else
  shell_home="$work/zsh"
fi

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/26-correzioni-interfaccia/COPIONE.md. Chiudi la finestra per finire.
TXT
cd "$root/apps/desktop"
env PATH="$bare_path" SHELL=/bin/zsh ZDOTDIR="$shell_home" "$electron" .
