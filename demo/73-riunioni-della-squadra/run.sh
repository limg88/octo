#!/usr/bin/env bash
# Demo 73: a meeting is of the project only when somebody of its team takes part.
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "73-riunioni-della-squadra"
