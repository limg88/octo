#!/usr/bin/env bash
# Demo 64: the ten kinds of the catalog of deliverables are files that travel with the app, one
# folder per kind. The demo runs on a copy of them, so a file can be changed and broken.
# KEEP=1 keeps the project, the app state and the copy of the catalog of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-64"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  cp -R "$root/apps/desktop/resources/catalogo" "$work/catalogo"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
# Demo only: the catalog is read from the copy, a person is already signed in, Claude is fake.
export OCTO_CATALOG_DIR="$work/catalogo"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

echo "Catalogo di prova: $work/catalogo (una copia: quello dell'app non viene toccato)"
echo "Apro Octo: segui demo/64-catalogo-in-file/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
