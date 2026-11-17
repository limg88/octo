#!/usr/bin/env bash
# Demo 56: the panels of the settings — long lists of options that open on request, a command
# that says which settings it reads with, fields that say their format and what empty means, the
# cell a datum of the request goes into, lists of states that wrap while they are typed.
# Same synthetic project as demo 55, in a folder of its own.
# KEEP=1 keeps the project and the app state of a previous run.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_NAME="56-pannelli-di-configurazione" exec bash "$root/demo/55-revisione-ux-schermate/run.sh"
