#!/usr/bin/env bash
# Demo 80: the deliverables after the interface review. A row per document with its state, a
# catalog as a list grouped by who reads, the reading in two parts, the register with its totals.
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "80-deliverable-rivisti"
