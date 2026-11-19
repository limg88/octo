#!/usr/bin/env bash
# Demo 77: the tickets an alignment found missing, created in the internal Jira when the PM
# confirms. The Jira is a fake one on this computer: nothing leaves it.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-77"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
# The interpreter is not versioned: fetched once, pinned by its checksum.
node apps/desktop/scripts/fetch-python.mjs >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-alignment.ts "$work/Aurora"
  node demo/lib/fake-scripted.ts "$work/Aurora"
fi

# The fake Jira says its address on its first line, and goes away with the demo.
jira_log="$work/jira.log"
node demo/lib/fake-jira.ts >"$jira_log" &
jira_pid=$!
trap 'kill "$jira_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  [[ -s "$jira_log" ]] && break
  node -e 'setTimeout(() => {}, 100)'
done

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
export OCTO_DEV_JIRA_URL="$(head -1 "$jira_log")"

echo "Progetto di prova: $work/Aurora · Jira finto: $OCTO_DEV_JIRA_URL"
echo "Apro Octo: segui demo/77-ticket-su-jira/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
