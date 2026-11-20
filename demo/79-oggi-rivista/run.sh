#!/usr/bin/env bash
# Demo 79: the page of the day after the interface review. The meetings are rows of what comes
# now, every list is made of single rows, «Il punto» with nothing in it is one row.
# Synthetic project of «Oggi», fake Mail folder, fake Claude. The meeting starts in 40 minutes.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$root/demo/lib/open-today.sh"
open_today_demo 79-oggi-rivista
