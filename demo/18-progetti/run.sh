#!/usr/bin/env bash
# Demo 18: the project switcher, and a project taken off the list that comes back as it was.
# KEEP=1 keeps the projects and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-18"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  node demo/lib/fake-mail.ts "$work/Mail"
  mkdir -p "$work/Boreale"
  printf '# Boreale\n\nIl collaudo del progetto Boreale è previsto a gennaio 2027.\n' > "$work/Boreale/stato.md"
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$work/Aurora","addedAt":"2026-11-14T08:00:00.000Z"},
 {"id":"demo-boreale","name":"Boreale","folder":"$work/Boreale","addedAt":"2026-11-15T08:00:00.000Z"}]
JSON
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Progetti di prova: $work/Aurora e $work/Boreale"
echo "Apro Octo: segui demo/18-progetti/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
