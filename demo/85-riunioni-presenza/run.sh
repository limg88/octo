#!/usr/bin/env bash
# Demo 85: one person of the team alone does not make a meeting of the project.
# Runs the cases of the rule, in the domain and through the reading of the meetings. No real data.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pnpm vitest run packages/domain/test/meetings.test.ts packages/application/test/meetings.test.ts \
  -t "tells a meeting as of a project|by one of its people alone|all its known people" --reporter=verbose
