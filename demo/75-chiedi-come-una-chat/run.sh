#!/usr/bin/env bash
# Demo 75: «Chiedi» as a chat.
# Synthetic project, fake Mail folder, fake Claude. KEEP=1 keeps a previous run.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/open-today.sh"
open_today_demo "75-chiedi-come-una-chat"
