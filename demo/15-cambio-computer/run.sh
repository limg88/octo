#!/usr/bin/env bash
# Demo 15: a backup on the old computer, a restore on a new one where the folder is elsewhere.
# Octo opens twice: first as the old computer, then, when its window is closed, as the new one.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-15"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
make_demo_project "$work"
mkdir -p "$work/Chiavetta" "$work/Nuovo computer"

export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "== Vecchio computer =="
echo "Cartella dove salvare la copia: $work/Chiavetta"
echo "Segui demo/15-cambio-computer/COPIONE.md fino al passo 3, poi chiudi la finestra."
OCTO_DATA_DIR="$work/dati" pnpm --filter @octo/desktop exec electron .

# The old computer is gone: only the project folder (copied elsewhere) and the backup are left.
mv "$work/Aurora" "$work/Nuovo computer/Aurora"
rm -rf "$work/dati"

echo
echo "== Nuovo computer =="
echo "Copia di sicurezza: $work/Chiavetta"
echo "Cartella del progetto, ora qui: $work/Nuovo computer/Aurora"
echo "Riprendi il copione dal passo 4. Chiudi la finestra per finire."
OCTO_DATA_DIR="$work/dati-nuovo" pnpm --filter @octo/desktop exec electron .
