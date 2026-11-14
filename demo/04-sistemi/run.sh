#!/usr/bin/env bash
# Demo 04: the work items of a fake Azure DevOps become files of the project.
# REAL=1 uses Claude Code on your own seat for the questions; Azure DevOps stays the fake one.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-04"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
fi

node demo/lib/fake-ado.ts > "$work/ado.url" &
ado_pid=$!
trap 'kill "$ado_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [[ -s "$work/ado.url" ]] && break; sleep 0.1; done

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_DEV_ADO_URL="$(cat "$work/ado.url")"
# Demo only: the fake token is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Azure DevOps finto: $OCTO_DEV_ADO_URL (organizzazione contoso, progetto Aurora, token demo-pat)"
echo "Apro Octo: segui demo/04-sistemi/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
