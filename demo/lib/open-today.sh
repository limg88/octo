# The demos of the second trial open the same synthetic project of «Oggi» with a fake Claude;
# what changes is the script the PM follows. Usage: open_today_demo <folder of the demo>.
# KEEP=1 keeps the project and the app state of a previous run.
open_today_demo() {
  local demo="$1"
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local work="$root/.tmp/demo-${demo%%-*}"
  source "$root/demo/lib/project.sh"
  source "$root/demo/lib/today-project.sh"
  cd "$root"
  pnpm install --frozen-lockfile >/dev/null
  pnpm build >/dev/null
  if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
    OCTO_DEMO_DOUBTFUL_MEETING=1 OCTO_DEMO_MEETING_IN_MINUTES=40 make_today_project "$work"
  fi
  export OCTO_DATA_DIR="$work/dati"
  export OCTO_MAIL_ROOT="$work/Mail"
  export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
  export OCTO_DEMO_PLAIN_SECRETS=1
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
  echo "Progetto di prova: $work/Aurora"
  echo "Apro Octo: segui demo/$demo/COPIONE.md. Chiudi la finestra per finire."
  pnpm --filter @octo/desktop exec electron .
}
