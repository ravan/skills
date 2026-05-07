#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/linkedin-gather.js"
ENV_CHECK_PATH="$SCRIPT_DIR/check-linkedin-env.sh"

env_args=()
for ((i = 1; i <= $#; i++)); do
  if [ "${!i}" = "--env-file" ]; then
    next=$((i + 1))
    if [ "$next" -le "$#" ]; then
      env_args=(--env-file "${!next}")
    fi
    break
  fi
done

"$ENV_CHECK_PATH" "${env_args[@]}" >&2
exec node "$SCRIPT_PATH" "$@"
