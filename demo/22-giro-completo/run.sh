#!/usr/bin/env bash
# Demo 22: the whole of Octo in one tour, on two synthetic projects and fake systems.
# KEEP=1 keeps the projects and the app state of a previous run.
# REAL=1 uses Claude Code on your own seat instead of the fake one.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-22"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  aurora="$work/Aurora"
  node demo/lib/fake-mail.ts "$work/Mail"
  node demo/lib/fake-documents.ts "$aurora"
  node demo/lib/fake-tracker.ts "$aurora"
  node demo/lib/fake-hours.ts "$aurora"
  node demo/lib/fake-forecast.ts "$aurora" hours
  node demo/lib/fake-progress.ts "$aurora"
  node demo/lib/fake-alignment.ts "$aurora"
  # What a PM sets once is already set, so that the tour shows results and not forms.
  node -e '
    const { readFileSync, writeFileSync, existsSync } = require("node:fs")
    const [folder] = process.argv.slice(1)
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
    })
    set("hours", {
      timesheetPath: "dati/Timesheets",
      worklogPath: "dati/ore-tracker/worklog_" + process.argv[2] + ".csv",
      projects: ["PRJ000101"],
    })
    set("alignment", { sprint: "Sprint 28", tags: ["Squadra"] })
  ' "$aurora" "$(ls "$aurora/dati/ore-tracker" | sed -E "s/worklog_(.*)\.csv/\1/")"
  # A second project, to show how one moves from a project to another.
  mkdir -p "$work/Boreale"
  printf '# Boreale\n\nIl collaudo del progetto Boreale è previsto a gennaio 2027.\n' > "$work/Boreale/stato.md"
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$aurora","addedAt":"2026-11-14T08:00:00.000Z"},
 {"id":"demo-boreale","name":"Boreale","folder":"$work/Boreale","addedAt":"2026-11-15T08:00:00.000Z"}]
JSON
fi

# The systems are fake and live on this computer for as long as the window is open.
pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT
# Not in a subshell: the trap must know the processes it has to stop.
start_fake() {
  node "demo/lib/fake-$1.ts" > "$work/$1.url" 2>/dev/null &
  pids+=("$!")
  for _ in $(seq 1 80); do [[ -s "$work/$1.url" ]] && break; sleep 0.1; done
  [[ -s "$work/$1.url" ]] || { echo "Il sistema finto $1 non è partito." >&2; exit 1; }
  export "$2=$(cat "$work/$1.url")"
}
rm -f "$work"/*.url
start_fake ado OCTO_DEV_ADO_URL
start_fake jira OCTO_DEV_JIRA_URL
start_fake confluence OCTO_DEV_CONFLUENCE_URL

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
# Demo only: the fake tokens are kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

cat <<TXT
Progetti di prova: $work/Aurora e $work/Boreale
Sistemi finti su questo computer:
  Azure DevOps  organizzazione contoso, progetto Aurora, token demo-pat
  Jira          sito demo, email pm@example.test, token demo-token, progetto AUR
  Confluence    sito demo, email pm@example.test, token demo-token, spazio AUR
Apro Octo: segui demo/22-giro-completo/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
