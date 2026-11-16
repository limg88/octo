#!/usr/bin/env bash
# Demo 23: the sign-in with the organization's account and «Oggi», the daily summary of the PM,
# on two synthetic projects, with a fake sign-in, a fake Mail folder and a fake Claude.
# KEEP=1 keeps the projects and the app state of a previous run.
# REAL=1 uses Claude Code on your own seat instead of the fake one.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-23"
source "$root/demo/lib/project.sh"
source "$root/demo/lib/today-project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_today_project "$work"
  # A second project, with nothing to say: for the page of all the projects.
  mkdir -p "$work/Boreale"
  printf '# Boreale\n\nIl collaudo del progetto Boreale è previsto a gennaio 2027.\n' > "$work/Boreale/stato.md"
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$work/Aurora","addedAt":"2026-11-14T08:00:00.000Z"},
 {"id":"demo-boreale","name":"Boreale","folder":"$work/Boreale","addedAt":"2026-11-15T08:00:00.000Z"}]
JSON
fi

# The sign-in is fake and lives on this computer for as long as the window is open.
entra_pid=""
trap '[[ -n "$entra_pid" ]] && kill "$entra_pid" 2>/dev/null || true' EXIT
rm -f "$work/entra.url"
node demo/lib/fake-entra.ts > "$work/entra.url" 2>/dev/null &
entra_pid="$!"
for _ in $(seq 1 80); do [[ -s "$work/entra.url" ]] && break; sleep 0.1; done
[[ -s "$work/entra.url" ]] || { echo "L'accesso finto non è partito." >&2; exit 1; }

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
# Where the organization signs in: here, the fake one. No demo person is signed in beforehand.
export OCTO_DEV_ENTRA_URL="$(cat "$work/entra.url")"
export OCTO_ENTRA_TENANT="11111111-2222-3333-4444-555555555555"
export OCTO_ENTRA_CLIENT="octo-demo"
# Demo only: what renews the sign-in is kept without the system keychain.
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

cat <<TXT
Progetti di prova: $work/Aurora e $work/Boreale
Accesso finto: $OCTO_DEV_ENTRA_URL (un solo pulsante, nessuna password)
Apro Octo: segui demo/23-oggi/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
