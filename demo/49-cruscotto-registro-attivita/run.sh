#!/usr/bin/env bash
# Demo 49: the dashboard of a Jira kept as a register of activities: no bug, no sprint, a few
# tasks and stories with their hours and their comments. Jira is already linked.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-49"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

node demo/lib/fake-jira-registro.ts "$work/Aurora" "$work/dati" > "$work/jira.url" &
jira_pid=$!
trap 'kill "$jira_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [[ -s "$work/jira.url" ]] && break; sleep 0.1; done

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_DEV_JIRA_URL="$(cat "$work/jira.url")"
# Demo only: the fake token is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Jira finto: $OCTO_DEV_JIRA_URL (già collegato, progetto AUR: 3 task e 2 storie, nessun bug, nessuno sprint)"
echo "Apro Octo: segui demo/49-cruscotto-registro-attivita/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
