#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STABLE_BUCKET_PATTERN='^skills/(engineering|productivity|misc)/[^/]+/SKILL\.md$'
PRIVATE_BUCKET_PATTERN='^skills/(personal|in-progress|deprecated)/[^/]+/SKILL\.md$'
NAME_PATTERN='^[a-z0-9]+(-[a-z0-9]+)*$'

cd "$REPO"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

extract_frontmatter_value() {
  local file="$1"
  local key="$2"
  awk -v key="$key" '
    NR == 1 && $0 != "---" { exit 1 }
    NR > 1 && $0 == "---" { exit 0 }
    NR > 1 {
      prefix = key ":"
      if (index($0, prefix) == 1) {
        value = substr($0, length(prefix) + 1)
        gsub(/^[ \t]+|[ \t]+$/, "", value)
        gsub(/^"|"$/, "", value)
        print value
        exit 0
      }
    }
  ' "$file"
}

skill_files=()
while IFS= read -r skill_md; do
  skill_files+=("$skill_md")
done < <(find skills -name SKILL.md -not -path '*/node_modules/*' | sort)

for skill_md in "${skill_files[@]}"; do
  skill_dir="$(dirname "$skill_md")"
  dir_name="$(basename "$skill_dir")"
  name="$(extract_frontmatter_value "$skill_md" name || true)"
  description="$(extract_frontmatter_value "$skill_md" description || true)"

  [ -n "$name" ] || fail "$skill_md is missing frontmatter field: name"
  [ -n "$description" ] || fail "$skill_md is missing frontmatter field: description"
  [ "$name" = "$dir_name" ] || fail "$skill_md name '$name' does not match directory '$dir_name'"
  [[ "$name" =~ $NAME_PATTERN ]] || fail "$skill_md name '$name' is not lowercase kebab-case"

  if [ "${#name}" -gt 64 ]; then
    fail "$skill_md name exceeds 64 characters"
  fi

  if [ "${#description}" -gt 1024 ]; then
    fail "$skill_md description exceeds 1024 characters"
  fi

  if command -v skills-ref >/dev/null 2>&1; then
    skills-ref validate "$skill_dir" >/dev/null
  fi
done

for path in \
  skills/engineering/README.md \
  skills/productivity/README.md \
  skills/misc/README.md \
  skills/personal/README.md \
  skills/in-progress/README.md \
  skills/deprecated/README.md
do
  [ -f "$path" ] || fail "missing bucket README: $path"
done

if [ -f CLAUDE.md ]; then
  fail "CLAUDE.md exists; AGENTS.md is canonical unless the user explicitly requests Claude instructions"
fi

[ -f AGENTS.md ] || fail "missing AGENTS.md"
[ -f .claude-plugin/plugin.json ] || fail "missing .claude-plugin/plugin.json"
[ -f .agents/plugins/marketplace.json ] || fail "missing .agents/plugins/marketplace.json"

if grep -E '"\./skills/(personal|in-progress|deprecated)/' .claude-plugin/plugin.json .agents/plugins/marketplace.json >/dev/null; then
  fail "generated manifests include private, in-progress, or deprecated skills"
fi

for skill_md in "${skill_files[@]}"; do
  if [[ "$skill_md" =~ $STABLE_BUCKET_PATTERN ]]; then
    skill_path="./$(dirname "$skill_md")"
    grep -F "\"$skill_path\"" .claude-plugin/plugin.json >/dev/null || fail "$skill_path missing from .claude-plugin/plugin.json"
    grep -F "\"path\": \"$skill_path\"" .agents/plugins/marketplace.json >/dev/null || fail "$skill_path missing from .agents/plugins/marketplace.json"
  elif [[ "$skill_md" =~ $PRIVATE_BUCKET_PATTERN ]]; then
    skill_path="./$(dirname "$skill_md")"
    if grep -F "$skill_path" .claude-plugin/plugin.json .agents/plugins/marketplace.json >/dev/null; then
      fail "$skill_path should not appear in generated manifests"
    fi
  fi
done

printf 'validated %s skill(s)\n' "${#skill_files[@]}"
