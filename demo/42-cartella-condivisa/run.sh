#!/usr/bin/env bash
# Demo 42: one project folder opened by two computers, as a folder kept in step by OneDrive is.
# Two Octos run on this computer, each with its own data folder, person and computer name; the
# folder of the project is the same. Azure DevOps is the fake one of demo 04.
# REAL=1 uses Claude Code on your own seat for the questions.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-42"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  # The second computer: its own data folder, the same project folder under its own id.
  mkdir -p "$work/dati-pc"
  cat > "$work/dati-pc/projects.json" <<JSON
[{"id":"demo-aurora-pc","name":"Aurora","folder":"$work/Aurora","addedAt":"2026-11-17T08:00:00.000Z"}]
JSON
  mkdir -p "$work/OneDrive"
fi

node demo/lib/fake-ado.ts > "$work/ado.url" &
ado_pid=$!
mac_pid=""
trap 'kill "$ado_pid" ${mac_pid:+"$mac_pid"} 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do [[ -s "$work/ado.url" ]] && break; sleep 0.1; done

export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_VERBALE_DIR="$work/Verbale-assente"
export OCTO_DEV_ADO_URL="$(cat "$work/ado.url")"
# Demo only: the fake token is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Azure DevOps finto: $OCTO_DEV_ADO_URL (organizzazione contoso, progetto Aurora, token demo-pat)"
echo "Cartella del progetto, la stessa per i due computer: $work/Aurora"
echo "Apro due Octo: «Giovanni · mac-di-giovanni» e «Giovanna · pc-di-giovanna»."
echo "Segui demo/42-cartella-condivisa/COPIONE.md. Chiudi la finestra di Giovanna per finire."

# Demo only: a person already signed in and a computer name, one for each window.
OCTO_DATA_DIR="$work/dati" \
  OCTO_DEMO_IDENTITY="Giovanni Rossi <giovanni@example.test>" \
  OCTO_COMPUTER_NAME="mac-di-giovanni" \
  pnpm --filter @octo/desktop exec electron . &
mac_pid=$!

OCTO_DATA_DIR="$work/dati-pc" \
  OCTO_DEMO_IDENTITY="Giovanna Bianchi <giovanna@example.test>" \
  OCTO_COMPUTER_NAME="pc-di-giovanna" \
  pnpm --filter @octo/desktop exec electron .
