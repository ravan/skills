#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_PATH="$SCRIPT_DIR/linkedin-login.spec.js"
PROJECT_ROOT="${LINKEDIN_LOGIN_PROJECT_ROOT:-$PWD}"
LINKEDIN_LOGIN_TEMP_ROOT=""
LINKEDIN_LOGIN_CHROME_PID=""
PLAYWRIGHT_PACKAGE="${LINKEDIN_LOGIN_PLAYWRIGHT_PACKAGE:-@playwright/test@latest}"
PLAYWRIGHT_ARGS=("$@")
if [ "$#" -eq 0 ]; then
  PLAYWRIGHT_ARGS=(--headed --reporter=line)
fi

ensure_playwright_cli() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is required to install and run the Playwright CLI." >&2
    exit 1
  fi

  if ! command -v playwright >/dev/null 2>&1; then
    echo "Playwright CLI not found; installing ${PLAYWRIGHT_PACKAGE} via npm exec." >&2
  fi
}

run_playwright() {
  local command
  local arg
  local spec_file

  ensure_playwright_cli

  spec_file="$(basename "$SPEC_PATH")"
  printf -v command 'cd %q; PLAYWRIGHT_BIN=$(command -v playwright); export NODE_PATH=$(dirname "$(dirname "$PLAYWRIGHT_BIN")"); exec playwright test %q' "$SCRIPT_DIR" "$spec_file"
  for arg in "$@"; do
    printf -v command '%s %q' "$command" "$arg"
  done

  LINKEDIN_LOGIN_PROJECT_ROOT="$PROJECT_ROOT" npm exec --yes --package "$PLAYWRIGHT_PACKAGE" --call "$command"
}

contains_list_arg() {
  for arg in "$@"; do
    if [ "$arg" = "--list" ]; then
      return 0
    fi
  done

  return 1
}

discover_macos_profile() {
  node <<'NODE'
const fs = require('fs');
const path = require('path');

const chromeRoot = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');
const localStatePath = path.join(chromeRoot, 'Local State');
const explicit = process.env.LINKEDIN_LOGIN_CHROME_PROFILE_DIRECTORY;

if (explicit) {
  process.stdout.write(explicit);
  process.exit(0);
}

try {
  const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
  const lastActive = localState.profile?.last_active_profiles?.[0];
  const ordered = localState.profile?.profiles_order?.[0];
  process.stdout.write(lastActive || ordered || 'Default');
} catch {
  process.stdout.write('Default');
}
NODE
}

wait_for_cdp() {
  local url="$1"
  local deadline=$((SECONDS + 20))

  until curl -fsS --max-time 1 "$url/json/version" >/dev/null 2>&1; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    sleep 0.5
  done
}

run_with_macos_chrome() {
  local chrome_bin="${LINKEDIN_LOGIN_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
  local chrome_root="${LINKEDIN_LOGIN_CHROME_ROOT:-$HOME/Library/Application Support/Google/Chrome}"
  local profile_dir
  local temp_root
  local port
  local cdp_url

  if [ ! -x "$chrome_bin" ] || [ ! -d "$chrome_root" ]; then
    run_playwright "${PLAYWRIGHT_ARGS[@]}"
    return
  fi

  profile_dir="$(discover_macos_profile)"
  if [ ! -d "$chrome_root/$profile_dir" ]; then
    echo "ERROR: Chrome profile not found: $chrome_root/$profile_dir" >&2
    exit 1
  fi

  temp_root="$(mktemp -d "${TMPDIR:-/tmp}/linkedin-login-chrome.XXXXXX")"
  port="${LINKEDIN_LOGIN_CDP_PORT:-9222}"
  cdp_url="http://127.0.0.1:$port"

  cleanup() {
    if [ -n "$LINKEDIN_LOGIN_CHROME_PID" ] && kill -0 "$LINKEDIN_LOGIN_CHROME_PID" >/dev/null 2>&1; then
      kill "$LINKEDIN_LOGIN_CHROME_PID" >/dev/null 2>&1 || true
      wait "$LINKEDIN_LOGIN_CHROME_PID" 2>/dev/null || true
    fi
    if [ -n "$LINKEDIN_LOGIN_TEMP_ROOT" ]; then
      rm -rf "$LINKEDIN_LOGIN_TEMP_ROOT"
    fi
  }
  trap cleanup EXIT

  mkdir -p "$temp_root/$profile_dir"
  if [ -f "$chrome_root/Local State" ]; then
    cp "$chrome_root/Local State" "$temp_root/Local State"
  fi

  rsync -a \
    --exclude='Cache' \
    --exclude='Code Cache' \
    --exclude='GPUCache' \
    --exclude='GrShaderCache' \
    --exclude='ShaderCache' \
    --exclude='Service Worker/CacheStorage' \
    "$chrome_root/$profile_dir/" \
    "$temp_root/$profile_dir/"

  "$chrome_bin" \
    --user-data-dir="$temp_root" \
    --profile-directory="$profile_dir" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$port" \
    --remote-allow-origins='*' \
    --no-first-run \
    --no-default-browser-check \
    "https://www.linkedin.com/login" \
    >/tmp/linkedin-login-chrome.log 2>&1 &
  LINKEDIN_LOGIN_CHROME_PID=$!
  LINKEDIN_LOGIN_TEMP_ROOT="$temp_root"

  if ! wait_for_cdp "$cdp_url"; then
    echo "ERROR: Chrome did not open the remote debugging port at $cdp_url" >&2
    sed -n '1,120p' /tmp/linkedin-login-chrome.log >&2 || true
    exit 1
  fi

  LINKEDIN_LOGIN_CDP_URL="$cdp_url" run_playwright "${PLAYWRIGHT_ARGS[@]}"
}

if contains_list_arg "${PLAYWRIGHT_ARGS[@]}"; then
  run_playwright "${PLAYWRIGHT_ARGS[@]}"
elif [ "$(uname -s)" = "Darwin" ] && [ "${LINKEDIN_LOGIN_USE_PLAYWRIGHT_CHROME:-0}" != "1" ]; then
  run_with_macos_chrome
else
  run_playwright "${PLAYWRIGHT_ARGS[@]}"
fi
