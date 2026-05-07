#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-codex}"

case "$TARGET" in
  codex)
    DEST="$REPO/.agents/skills"
    ;;
  claude)
    DEST="$HOME/.claude/skills"
    ;;
  *)
    printf 'usage: scripts/link-skills.sh [codex|claude]\n' >&2
    exit 1
    ;;
esac

if [ -L "$DEST" ]; then
  resolved="$(readlink "$DEST")"
  printf 'error: %s is a symlink to %s; remove it before linking skills\n' "$DEST" "$resolved" >&2
  exit 1
fi

mkdir -p "$DEST"

find "$REPO/skills/engineering" "$REPO/skills/productivity" "$REPO/skills/misc" \
  -name SKILL.md -not -path '*/node_modules/*' -print0 2>/dev/null |
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  name="$(basename "$src")"
  target="$DEST/$name"

  if [ -e "$target" ] && [ ! -L "$target" ]; then
    printf 'error: %s exists and is not a symlink\n' "$target" >&2
    exit 1
  fi

  ln -sfn "$src" "$target"
  printf 'linked %s -> %s\n' "$name" "$src"
done
