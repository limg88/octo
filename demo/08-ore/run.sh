#!/usr/bin/env bash
# Demo 08: timesheet hours against the hours logged on the tracker, from exports in the project.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-08"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi
node "$root/demo/lib/fake-hours.ts" "$work/Aurora"

node demo/lib/fake-jira.ts > "$work/jira.url" &
jira_pid=$!
trap 'kill "$jira_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [[ -s "$work/jira.url" ]] && break; sleep 0.1; done

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
export OCTO_DEV_JIRA_URL="$(cat "$work/jira.url")"
# Demo only: the fake token is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1

echo "Progetto di prova: $work/Aurora"
echo "Jira finto: $OCTO_DEV_JIRA_URL (sito demo, email pm@example.test, token demo-token, progetto AUR)"
echo "Apro Octo: segui demo/08-ore/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
