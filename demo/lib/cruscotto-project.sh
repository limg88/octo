#!/usr/bin/env bash
# Creates the synthetic project «Aurora» for the demos of the dashboard and starts a fake Azure
# DevOps with sprints, stories, bugs and comments. The source, its token, the people of the two
# sides and the calendar are already set: the PM only has to read.
# Usage: source demo/lib/project.sh; source demo/lib/cruscotto-project.sh
#        start_cruscotto_demo <work folder>     (sets ado_pid and exports the environment)
start_cruscotto_demo() {
  local work="$1"
  if [[ "${KEEP:-0}" != "1" || ! -d "$work/dati" ]]; then
    make_demo_project "$work"
  fi
  rm -f "$work/ado.url"
  node demo/lib/fake-ado-cruscotto.ts "$work/Aurora" "$work/dati" > "$work/ado.url" &
  ado_pid=$!
  echo "$ado_pid" > "$work/ado.pid"
  trap 'kill "$ado_pid" 2>/dev/null || true' EXIT
  for _ in $(seq 1 50); do [[ -s "$work/ado.url" ]] && break; sleep 0.1; done

  export OCTO_DATA_DIR="$work/dati"
  # Demo only: a person already signed in, without asking any organization.
  export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
  export OCTO_MAIL_ROOT="$work/Mail-assente"
  export OCTO_DEV_ADO_URL="$(cat "$work/ado.url")"
  # Demo only: the fake token is kept without the system keychain.
  export OCTO_DEMO_PLAIN_SECRETS=1
  if [[ "${NO_CLAUDE:-0}" == "1" ]]; then
    export OCTO_CLAUDE_PATH="$work/claude-che-non-c-e"
  elif [[ "${REAL:-0}" != "1" ]]; then
    export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"
  fi
}
