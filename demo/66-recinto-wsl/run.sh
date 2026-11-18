#!/usr/bin/env bash
# Demo 66: how Octo starts Claude Code inside WSL2 on a Windows PC, shown on this computer with
# a stand-in for wsl.exe: the paths as the distribution sees them, the script that carries the
# command, the fence drawn on those paths, a whole run through it.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
pnpm install --frozen-lockfile >/dev/null
node demo/66-recinto-wsl/mostra.ts
