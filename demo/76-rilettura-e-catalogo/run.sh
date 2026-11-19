#!/usr/bin/env bash
# Demo 76: a critical reading of a few lines, and a catalog that says what its kinds are.
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "76-rilettura-e-catalogo"
