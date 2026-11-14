#!/usr/bin/env bash
# Demo 02: the mail of the project is read from a fake Mail archive into the project folder.
# REAL=1 uses Claude Code on your own seat for the questions; the mail archive stays the fake one.
# KEEP=1 keeps the project, the archive and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-02"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-mail.ts "$work/Mail"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora"
echo "Archivio di posta finto: $work/Mail (6 mail, 2 del progetto)"
echo "Per far arrivare una mail nuova: node demo/lib/fake-mail.ts \"$work/Mail\" extra"
echo "Apro Octo: segui demo/02-posta/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
