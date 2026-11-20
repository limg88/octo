#!/usr/bin/env bash
# Demo 83: «Chiedi» after the interface review. One source in view for the whole conversation,
# the sources of an answer and what can be done with it on one row, a quiet «Nuova chat».
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "83-chiedi-rivisto"
