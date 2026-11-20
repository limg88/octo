#!/usr/bin/env bash
# Demo 78: the common rules of the interface review. One shape for every mark of state or kind,
# section headings as headings, figures in one band, a readable red in the dark theme.
# Synthetic project of «Oggi», fake Mail folder, fake Claude.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$root/demo/lib/open-today.sh"
open_today_demo 78-stati-e-regole-comuni
