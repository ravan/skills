#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
usage: check-linkedin-env.sh [--env-file FILE]

Checks LinkedIn auth configuration without printing secret values.
USAGE
}

env_file="${LINKEDIN_AUTH_ENV_FILE:-.env}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      if [ "$#" -lt 2 ]; then
        printf 'LINKEDIN_ENV_CHECK status=error error=missing-env-file-argument\n' >&2
        exit 2
      fi
      env_file="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'LINKEDIN_ENV_CHECK status=error error=unknown-argument argument=%q\n' "$1" >&2
      exit 2
      ;;
  esac
done

value_state() {
  local key="$1"
  local file_value=""

  if [ -f "$env_file" ]; then
    file_value="$(
      awk -v key="$key" '
        $0 ~ "^[[:space:]]*#" { next }
        $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
          sub("^[[:space:]]*" key "[[:space:]]*=", "")
          gsub("^[[:space:]]+|[[:space:]]+$", "")
          if (($0 ~ /^".*"$/) || ($0 ~ /^'\''.*'\''$/)) {
            $0 = substr($0, 2, length($0) - 2)
          }
          print
          exit
        }
      ' "$env_file"
    )"
  fi

  if [ -n "$file_value" ]; then
    printf 'set'
  else
    printf 'missing'
  fi
}

li_at_state="$(value_state LINKEDIN_LI_AT)"
jsessionid_state="$(value_state LINKEDIN_JSESSIONID)"

if [ ! -f "$env_file" ]; then
  printf 'LINKEDIN_ENV_CHECK status=missing-file env_file=%q LINKEDIN_LI_AT=%s LINKEDIN_JSESSIONID=%s\n' "$env_file" "$li_at_state" "$jsessionid_state"
  exit 1
fi

if [ "$li_at_state" != "set" ] || [ "$jsessionid_state" != "set" ]; then
  printf 'LINKEDIN_ENV_CHECK status=missing-values env_file=%q LINKEDIN_LI_AT=%s LINKEDIN_JSESSIONID=%s\n' "$env_file" "$li_at_state" "$jsessionid_state"
  exit 1
fi

printf 'LINKEDIN_ENV_CHECK status=ok env_file=%q LINKEDIN_LI_AT=set LINKEDIN_JSESSIONID=set\n' "$env_file"
