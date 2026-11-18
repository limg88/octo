#!/usr/bin/env bash
# Demo 62: Claude computes inside its fence. It reads the project, runs the interpreter Octo
# ships and writes only in a work folder of the app; Octo copies in the project what the PM keeps.
# REAL=1 uses Claude Code on your own seat, with the real sandbox, instead of the fake model.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-62"
source "$root/demo/lib/project.sh"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
# The interpreter is not versioned: fetched once, pinned by its checksum.
node apps/desktop/scripts/fetch-python.mjs >/dev/null
pnpm build >/dev/null
# KEEP=1 keeps the project and the history of a previous run.
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  mkdir -p "$work/Aurora/dati"
  # Synthetic sales, one row per sale: too many to add up by reading.
  node -e '
    const regions = ["Nord", "Centro", "Sud", "Isole"]
    const rows = ["regione,importo"]
    for (let i = 0; i < 5000; i += 1) rows.push(`${regions[i % 4]},${((i * 37) % 900) + 100}`)
    require("node:fs").writeFileSync(process.argv[1], rows.join("\n") + "\n")
  ' "$work/Aurora/dati/vendite.csv"
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail-assente"
# Demo only: a person already signed in, without asking any organization.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

echo "Progetto di prova: $work/Aurora (dati/vendite.csv, 5.000 righe sintetiche)"
echo "Apro Octo: segui demo/62-recinto-calcolo/COPIONE.md. Chiudi la finestra per finire."
pnpm --filter @octo/desktop exec electron .
