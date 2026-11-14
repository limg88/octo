#!/usr/bin/env bash
# Creates a synthetic project folder and an app data folder that already lists it.
# Usage: source demo/lib/project.sh; make_demo_project <work folder>
make_demo_project() {
  local work="$1"
  rm -rf "$work"
  mkdir -p "$work/Aurora/wiki" "$work/dati"
  cat > "$work/Aurora/wiki/stato.md" <<'MD'
# Stato del progetto Aurora

La consegna del modulo ordini è fissata al 12 dicembre 2026.
Il budget residuo è di 14.500 euro.
MD
  cat > "$work/dati/projects.json" <<JSON
[{"id":"demo-aurora","name":"Aurora","folder":"$work/Aurora","addedAt":"2026-11-14T08:00:00.000Z"}]
JSON
}
