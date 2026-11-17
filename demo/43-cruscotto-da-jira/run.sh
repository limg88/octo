#!/usr/bin/env bash
# Demo 43: the dashboard of a project without Azure DevOps, computed from Jira as it is now.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-43"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

node demo/lib/fake-jira-cruscotto.ts > "$work/jira.url" &
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

echo "Jira finto: $OCTO_DEV_JIRA_URL (sito demo, email pm@example.test, token demo-token, progetto AUR)"
echo "Apro Octo: segui demo/43-cruscotto-da-jira/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
