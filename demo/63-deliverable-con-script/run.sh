#!/usr/bin/env bash
# Demo 63: the progress form and the alignment of a sprint as deliverables of the project made
# by a script. The script and its data are files of the project; Claude runs them inside its
# fence; the PM corrects them in words; Octo fills the form of the client and keeps what is kept.
# REAL=1 uses Claude Code on your own seat, with the real sandbox, instead of the fake model.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-63"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
# The interpreter is not versioned: fetched once, pinned by its checksum.
node apps/desktop/scripts/fetch-python.mjs >/dev/null
pnpm build >/dev/null
# KEEP=1 keeps the project and the app state of a previous run.
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  # A project that used «Avanzamento» and «Allineamento»: their settings are in the project.
  node demo/lib/fake-progress.ts "$work/Aurora"
  node demo/lib/fake-alignment.ts "$work/Aurora"
  node demo/lib/fake-scripted.ts "$work/Aurora"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora (ordine ORD-2026-077 con due richieste; sprint 28 con sei voci)"
echo "Apro Octo: segui demo/63-deliverable-con-script/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
