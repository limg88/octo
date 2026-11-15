#!/usr/bin/env bash
# Demo 05: a project is set up from scratch with the guide — mail, Azure DevOps, documents — and
# its memory is filled in one go. Mail archive and Azure DevOps are fakes on this computer.
# REAL=1 uses Claude Code on your own seat for the questions.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-05"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
make_demo_project "$work"
node demo/lib/fake-mail.ts "$work/Mail" >/dev/null
node demo/lib/fake-documents.ts "$work/Aurora" >/dev/null

node demo/lib/fake-ado.ts > "$work/ado.url" &
ado_pid=$!
trap 'kill "$ado_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [[ -s "$work/ado.url" ]] && break; sleep 0.1; done

export OCTO_DATA_DIR="$work/dati"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEV_ADO_URL="$(cat "$work/ado.url")"
# Demo only: the fake token is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora (due documenti Office), posta finta, Azure DevOps finto."
echo "Azure DevOps: organizzazione contoso, token demo-pat."
echo "Apro Octo: segui demo/05-avvio-guidato/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
