#!/usr/bin/env bash
# Demo 84: the settings after the interface review. The sources as rows of one list with where
# their credential is, the people as a list to read with the person in view beside it, and
# every other part as rows: what it is on the left, how it is set on the right.
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "84-impostazioni-riviste"
