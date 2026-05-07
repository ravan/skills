#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STABLE_BUCKETS=("engineering" "productivity" "misc")
PLUGIN_NAME="ravan-skills"

cd "$REPO"
mkdir -p .claude-plugin .agents/plugins

stable_skill_dirs=()
for bucket in "${STABLE_BUCKETS[@]}"; do
  if [ -d "skills/$bucket" ]; then
    while IFS= read -r skill_md; do
      stable_skill_dirs+=("./$(dirname "$skill_md")")
    done < <(find "skills/$bucket" -name SKILL.md -not -path '*/node_modules/*' | sort)
  fi
done

{
  printf '{\n'
  printf '  "name": "%s",\n' "$PLUGIN_NAME"
  printf '  "skills": [\n'
  for i in "${!stable_skill_dirs[@]}"; do
    comma=","
    if [ "$i" -eq "$((${#stable_skill_dirs[@]} - 1))" ]; then
      comma=""
    fi
    printf '    "%s"%s\n' "${stable_skill_dirs[$i]}" "$comma"
  done
  printf '  ]\n'
  printf '}\n'
} > .claude-plugin/plugin.json

{
  printf '{\n'
  printf '  "name": "%s",\n' "$PLUGIN_NAME"
  printf '  "description": "Portable Agent Skills by Ravan.",\n'
  printf '  "skills": [\n'
  for i in "${!stable_skill_dirs[@]}"; do
    comma=","
    if [ "$i" -eq "$((${#stable_skill_dirs[@]} - 1))" ]; then
      comma=""
    fi
    printf '    {\n'
    printf '      "path": "%s"\n' "${stable_skill_dirs[$i]}"
    printf '    }%s\n' "$comma"
  done
  printf '  ]\n'
  printf '}\n'
} > .agents/plugins/marketplace.json

printf 'generated .claude-plugin/plugin.json\n'
printf 'generated .agents/plugins/marketplace.json\n'
