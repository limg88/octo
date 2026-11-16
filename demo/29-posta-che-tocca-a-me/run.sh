#!/usr/bin/env bash
# Demo 29: the mail that is the PM's to answer told apart from the mail the PM is only written to
# with others — by the headers, by the conversation, and by what Claude reads in each mail.
# Synthetic project, fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
# NO_CLAUDE=1 runs as on a computer without Claude Code.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-29"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-today.ts "$work/Aurora" "$work/Mail"
  node demo/lib/fake-mail-turns.ts "$work/Mail"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${NO_CLAUDE:-0}" == "1" ]]; then
  # As on a computer without Claude Code: only what the code is sure of asks an answer.
  export OCTO_CLAUDE_PATH="$work/claude-che-non-c-e"
else
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

cat <<TXT
Progetto di prova: $work/Aurora
Apro Octo: segui demo/29-posta-che-tocca-a-me/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
