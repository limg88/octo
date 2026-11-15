#!/usr/bin/env bash
# Demo 25: the meetings recorded with Verbale enter the memory of the right project — by the
# invitation in the mail, by the words of the title, or by the PM's hand from «Oggi» — on two
# synthetic projects, with a fake export folder of Verbale, a fake Mail folder and a fake Claude.
# KEEP=1 keeps the projects and the app state of a previous run.
# REAL=1 uses Claude Code on your own seat instead of the fake one.
# SETUP_ONLY=1 prepares the data and stops before opening Octo.
# AGAIN=1 only exports the first meeting again (a correction and a report), without opening Octo.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-25"
source "$root/demo/lib/project.sh"

cd "$root"
if [[ "${AGAIN:-0}" == "1" ]]; then
  node demo/lib/fake-verbale.ts "$work/Verbale" "$work/VerbaleSessioni" "$work/Mail" again
  echo "Riunione «Punto settimanale» esportata di nuovo da Verbale: in Octo premi «Leggi ora»."
  exit 0
fi
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
  make_demo_project "$work"
  aurora="$work/Aurora"
  boreale="$work/Boreale"
  # The mail of Aurora is already linked: its invitations tell whose a meeting is.
  node demo/lib/fake-today.ts "$aurora" "$work/Mail"
  node demo/lib/fake-verbale.ts "$work/Verbale" "$work/VerbaleSessioni" "$work/Mail"
  # A second project already reads the same folder of Verbale: a meeting is of one of the two.
  mkdir -p "$boreale/_octo/.impostazioni"
  printf '# Boreale\n\nIl collaudo del progetto Boreale è previsto a gennaio 2027.\n' > "$boreale/stato.md"
  cat > "$boreale/_octo/.impostazioni/sources.json" <<JSON
{"mail": null, "meetings": {"root": "$work/Verbale"}}
JSON
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$aurora","addedAt":"2026-11-14T08:00:00.000Z"},
 {"id":"demo-boreale","name":"Boreale","folder":"$boreale","addedAt":"2026-11-15T08:00:00.000Z"}]
JSON
fi

export OCTO_DATA_DIR="$work/dati"
export OCTO_MAIL_ROOT="$work/Mail"
export OCTO_VERBALE_SESSIONS="$work/VerbaleSessioni"
# Demo only: a person already signed in (the sign-in is shown by demo 23), and no system keychain.
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
if [[ "${REAL:-0}" != "1" ]]; then
  export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
fi

if [[ "${SETUP_ONLY:-0}" == "1" ]]; then exit 0; fi

cat <<TXT
Progetti di prova: $work/Aurora e $work/Boreale
Cartella in cui il Verbale finto esporta: $work/Verbale
Apro Octo: segui demo/25-riunioni-verbale/COPIONE.md. Chiudi la finestra per finire.
TXT
pnpm --filter @octo/desktop exec electron .
