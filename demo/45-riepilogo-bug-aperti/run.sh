#!/usr/bin/env bash
# Demo 45: the summary of the tracker Claude cites counts the open bugs as the dashboard does.
# Nothing is written: the summary of a synthetic tracker is printed in the terminal.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
pnpm install --frozen-lockfile >/dev/null
node demo/45-riepilogo-bug-aperti/riepilogo.ts
