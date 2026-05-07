# Agent Skills Repo Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial standalone, agent-agnostic skills repository plumbing at `/Users/ravan/suse/repo/github/ravan/skills`.

**Architecture:** The filesystem under stable skill buckets is the source of truth. Agent Skills compliance is enforced by local validation scripts, while runtime-specific manifests are generated adapters. `AGENTS.md` is the canonical agent instruction file for Codex and other agents.

**Tech Stack:** Bash scripts, POSIX shell utilities, Git, Markdown, JSON manifests, Agent Skills `SKILL.md` format.

---

## File Structure

- Create: `AGENTS.md`  
  Canonical instructions for Codex and other agents working in this repo.
- Create: `CONTEXT.md`  
  Shared vocabulary for this skills repository.
- Create: `README.md`  
  User-facing overview, layout, validation, and linking instructions.
- Create: `LICENSE`  
  Initial repository license.
- Create: `docs/adr/0001-agent-skills-standard-is-canonical.md`  
  Records the decision that Agent Skills is canonical and manifests are adapters.
- Create: `.claude-plugin/plugin.json`  
  Generated Claude-style plugin manifest.
- Create: `.agents/plugins/marketplace.json`  
  Generated local agent/Codex-oriented marketplace metadata.
- Create: `scripts/list-skills.sh`  
  Lists every `SKILL.md` file in the repo.
- Create: `scripts/validate-skills.sh`  
  Validates skill names, parent folder names, required frontmatter, stable docs, and generated manifests.
- Create: `scripts/generate-plugin-json.sh`  
  Rebuilds `.claude-plugin/plugin.json` and `.agents/plugins/marketplace.json`.
- Create: `scripts/link-skills.sh`  
  Links stable skills into local agent skill directories.
- Create: `skills/engineering/README.md`
- Create: `skills/productivity/README.md`
- Create: `skills/misc/README.md`
- Create: `skills/personal/README.md`
- Create: `skills/in-progress/README.md`
- Create: `skills/deprecated/README.md`
- Create: `skills/productivity/example-skill/SKILL.md`  
  A tiny standards-compliant stable skill used to prove scripts and manifests work.

## Task 1: Canonical Repo Documentation

**Files:**
- Create: `AGENTS.md`
- Create: `CONTEXT.md`
- Create: `README.md`
- Create: `LICENSE`
- Create: `docs/adr/0001-agent-skills-standard-is-canonical.md`

- [ ] **Step 1: Create the documentation files**

Create `AGENTS.md`:

```markdown
# Agent Instructions

This repository stores portable Agent Skills. Codex is the primary coding agent,
but the skills must remain usable by any client that supports the Agent Skills
standard.

## Repository Rules

- Treat the Agent Skills specification as the canonical contract.
- Keep `AGENTS.md` as the canonical repo instruction file.
- Do not create `CLAUDE.md` unless the user explicitly requests it.
- Treat `.claude-plugin/plugin.json` and `.agents/plugins/marketplace.json` as
  generated runtime adapters.
- Keep stable skills under `skills/engineering`, `skills/productivity`, or
  `skills/misc`.
- Do not include `skills/personal`, `skills/in-progress`, or
  `skills/deprecated` in generated public manifests.
- Every skill directory must contain `SKILL.md`.
- The `name` field in `SKILL.md` must match the skill directory name.
- Keep `SKILL.md` concise. Move detailed material into skill-local
  `references/`, `scripts/`, or `assets/` directories.

## Development Workflow

- Run `scripts/validate-skills.sh` before committing skill or manifest changes.
- Run `scripts/generate-plugin-json.sh` after adding, removing, or moving stable
  skills.
- Prefer small, focused commits.
- Do not mutate local agent installation folders unless the user asked to link
  skills.
```

Create `CONTEXT.md`:

```markdown
# Skills Repository Context

This repository contains portable Agent Skills.

## Language

**Agent Skill**:
A directory containing a `SKILL.md` file with YAML frontmatter and Markdown
instructions. A skill can bundle `scripts/`, `references/`, and `assets/`.

**Stable bucket**:
A skill category that is eligible for generated manifests and public indexes.
The stable buckets are `engineering`, `productivity`, and `misc`.

**Private bucket**:
A skill category excluded from generated manifests. The private or unstable
buckets are `personal`, `in-progress`, and `deprecated`.

**Runtime adapter**:
A generated file that lets a specific agent client discover skills. Runtime
adapters are not the source of truth.

## Relationships

- A stable bucket contains publishable Agent Skills.
- A private bucket contains skills that should not be published by default.
- Runtime adapters are generated from stable buckets.
- `AGENTS.md` defines repository-level instructions for agents working here.
```

Create `README.md`:

```markdown
# Skills

Portable Agent Skills for coding, productivity, and local workflows.

The repository follows the Agent Skills standard: each skill is a directory with
a `SKILL.md` file containing `name` and `description` frontmatter plus Markdown
instructions.

## Layout

```text
skills/
├── AGENTS.md
├── CONTEXT.md
├── README.md
├── .claude-plugin/plugin.json
├── .agents/plugins/marketplace.json
├── docs/adr/
├── scripts/
└── skills/
    ├── engineering/
    ├── productivity/
    ├── misc/
    ├── personal/
    ├── in-progress/
    └── deprecated/
```

## Stable Skills

Stable skills live in:

- `skills/engineering`
- `skills/productivity`
- `skills/misc`

These buckets are included in generated manifests.

Private, draft, or historical skills live in:

- `skills/personal`
- `skills/in-progress`
- `skills/deprecated`

These buckets are excluded from generated manifests.

## Commands

List skills:

```bash
scripts/list-skills.sh
```

Validate skills and generated manifests:

```bash
scripts/validate-skills.sh
```

Regenerate runtime adapters:

```bash
scripts/generate-plugin-json.sh
```

Link stable skills for local use with Codex-style project skills:

```bash
scripts/link-skills.sh codex
```

Link stable skills for Claude Code:

```bash
scripts/link-skills.sh claude
```

## Distribution

The source of truth is the `skills/` tree. Runtime-specific files are generated
adapters:

- `.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
```

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Ravan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Create `docs/adr/0001-agent-skills-standard-is-canonical.md`:

```markdown
# ADR 0001: Agent Skills Standard Is Canonical

## Status

Accepted.

## Context

This repository should work with Codex first, but the skills should remain
portable across clients that support the Agent Skills format.

Runtime-specific manifests are useful for discovery, but they should not define
the structure or behavior of skills.

## Decision

The Agent Skills specification is the canonical contract for skill content and
layout. Each skill is a directory with a `SKILL.md` file. The `name` frontmatter
must match the directory name.

`AGENTS.md` is the canonical repository instruction file. Runtime-specific files
such as `.claude-plugin/plugin.json` and `.agents/plugins/marketplace.json` are
generated adapters.

## Consequences

- Skills stay portable across compatible agents.
- Runtime manifests can be regenerated from the filesystem.
- Claude-specific instructions do not become the source of truth.
- Validation scripts must enforce the standard before changes are committed.
```

- [ ] **Step 2: Verify documentation files exist**

Run:

```bash
test -f AGENTS.md
test -f CONTEXT.md
test -f README.md
test -f LICENSE
test -f docs/adr/0001-agent-skills-standard-is-canonical.md
test ! -f CLAUDE.md
```

Expected: all commands exit with status `0`.

- [ ] **Step 3: Commit documentation**

Run:

```bash
git add AGENTS.md CONTEXT.md README.md LICENSE docs/adr/0001-agent-skills-standard-is-canonical.md
git commit -m "docs: add canonical repo guidance"
```

Expected: commit succeeds.

## Task 2: Skill Buckets And Example Skill

**Files:**
- Create: `skills/engineering/README.md`
- Create: `skills/productivity/README.md`
- Create: `skills/misc/README.md`
- Create: `skills/personal/README.md`
- Create: `skills/in-progress/README.md`
- Create: `skills/deprecated/README.md`
- Create: `skills/productivity/example-skill/SKILL.md`

- [ ] **Step 1: Create bucket README files**

Create `skills/engineering/README.md`:

```markdown
# Engineering

Coding and software delivery skills.

Stable skills in this bucket are included in generated manifests.
```

Create `skills/productivity/README.md`:

```markdown
# Productivity

Reusable non-code workflow skills.

Stable skills in this bucket are included in generated manifests.

- **[example-skill](./example-skill/SKILL.md)** - Minimal standards-compliant
  skill used to verify repository plumbing.
```

Create `skills/misc/README.md`:

```markdown
# Misc

Stable skills that are useful but rarely used.

Stable skills in this bucket are included in generated manifests.
```

Create `skills/personal/README.md`:

```markdown
# Personal

Skills tied to local preferences or private workflows.

Skills in this bucket are excluded from generated manifests.
```

Create `skills/in-progress/README.md`:

```markdown
# In Progress

Draft skills that are not ready to distribute.

Skills in this bucket are excluded from generated manifests.
```

Create `skills/deprecated/README.md`:

```markdown
# Deprecated

Skills retained for history.

Skills in this bucket are excluded from generated manifests.
```

- [ ] **Step 2: Create the example skill**

Create `skills/productivity/example-skill/SKILL.md`:

```markdown
---
name: example-skill
description: Demonstrates the repository's Agent Skills layout and validation plumbing. Use when verifying that skill discovery, validation, and generated manifests work.
---

# Example Skill

Use this skill only to verify repository plumbing.

When activated, report that the skill loaded successfully and mention the path
`skills/productivity/example-skill/SKILL.md`.
```

- [ ] **Step 3: Verify directory shape**

Run:

```bash
find skills -maxdepth 3 -type f | sort
```

Expected output:

```text
skills/deprecated/README.md
skills/engineering/README.md
skills/in-progress/README.md
skills/misc/README.md
skills/personal/README.md
skills/productivity/README.md
skills/productivity/example-skill/SKILL.md
```

- [ ] **Step 4: Commit buckets and example skill**

Run:

```bash
git add skills
git commit -m "feat: add skill buckets"
```

Expected: commit succeeds.

## Task 3: Skill Listing Script

**Files:**
- Create: `scripts/list-skills.sh`

- [ ] **Step 1: Write `scripts/list-skills.sh`**

Create `scripts/list-skills.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO"
find skills -name SKILL.md -not -path '*/node_modules/*' | sort
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/list-skills.sh
```

Expected: command exits with status `0`.

- [ ] **Step 3: Run the script**

Run:

```bash
scripts/list-skills.sh
```

Expected output:

```text
skills/productivity/example-skill/SKILL.md
```

- [ ] **Step 4: Commit listing script**

Run:

```bash
git add scripts/list-skills.sh
git commit -m "feat: add skill listing script"
```

Expected: commit succeeds.

## Task 4: Manifest Generation Script

**Files:**
- Create: `scripts/generate-plugin-json.sh`
- Create: `.claude-plugin/plugin.json`
- Create: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Write `scripts/generate-plugin-json.sh`**

Create `scripts/generate-plugin-json.sh`:

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/generate-plugin-json.sh
```

Expected: command exits with status `0`.

- [ ] **Step 3: Generate manifests**

Run:

```bash
scripts/generate-plugin-json.sh
```

Expected output:

```text
generated .claude-plugin/plugin.json
generated .agents/plugins/marketplace.json
```

- [ ] **Step 4: Inspect generated Claude manifest**

Run:

```bash
cat .claude-plugin/plugin.json
```

Expected output:

```json
{
  "name": "ravan-skills",
  "skills": [
    "./skills/productivity/example-skill"
  ]
}
```

- [ ] **Step 5: Inspect generated agent marketplace manifest**

Run:

```bash
cat .agents/plugins/marketplace.json
```

Expected output:

```json
{
  "name": "ravan-skills",
  "description": "Portable Agent Skills by Ravan.",
  "skills": [
    {
      "path": "./skills/productivity/example-skill"
    }
  ]
}
```

- [ ] **Step 6: Commit generator and manifests**

Run:

```bash
git add scripts/generate-plugin-json.sh .claude-plugin/plugin.json .agents/plugins/marketplace.json
git commit -m "feat: generate runtime skill manifests"
```

Expected: commit succeeds.

## Task 5: Validation Script

**Files:**
- Create: `scripts/validate-skills.sh`

- [ ] **Step 1: Write `scripts/validate-skills.sh`**

Create `scripts/validate-skills.sh`:

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/validate-skills.sh
```

Expected: command exits with status `0`.

- [ ] **Step 3: Run validation**

Run:

```bash
scripts/validate-skills.sh
```

Expected output:

```text
validated 1 skill(s)
```

- [ ] **Step 4: Commit validation script**

Run:

```bash
git add scripts/validate-skills.sh
git commit -m "feat: validate agent skills"
```

Expected: commit succeeds.

## Task 6: Link Script

**Files:**
- Create: `scripts/link-skills.sh`

- [ ] **Step 1: Write `scripts/link-skills.sh`**

Create `scripts/link-skills.sh`:

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/link-skills.sh
```

Expected: command exits with status `0`.

- [ ] **Step 3: Link Codex-style local skills**

Run:

```bash
scripts/link-skills.sh codex
```

Expected output:

```text
linked example-skill -> /Users/ravan/suse/repo/github/ravan/skills/skills/productivity/example-skill
```

- [ ] **Step 4: Verify local symlink**

Run:

```bash
readlink .agents/skills/example-skill
```

Expected output:

```text
/Users/ravan/suse/repo/github/ravan/skills/skills/productivity/example-skill
```

- [ ] **Step 5: Commit link script and local symlink**

Run:

```bash
git add scripts/link-skills.sh .agents/skills/example-skill
git commit -m "feat: link stable skills locally"
```

Expected: commit succeeds.

## Task 7: End-To-End Verification

**Files:**
- Modify: generated files only if verification exposes drift.

- [ ] **Step 1: Regenerate manifests**

Run:

```bash
scripts/generate-plugin-json.sh
```

Expected output:

```text
generated .claude-plugin/plugin.json
generated .agents/plugins/marketplace.json
```

- [ ] **Step 2: List skills**

Run:

```bash
scripts/list-skills.sh
```

Expected output:

```text
skills/productivity/example-skill/SKILL.md
```

- [ ] **Step 3: Validate skills**

Run:

```bash
scripts/validate-skills.sh
```

Expected output:

```text
validated 1 skill(s)
```

- [ ] **Step 4: Verify no `CLAUDE.md` exists**

Run:

```bash
test ! -f CLAUDE.md
```

Expected: command exits with status `0`.

- [ ] **Step 5: Verify git state contains only expected files**

Run:

```bash
git status --short --untracked-files=all
```

Expected output is empty. If generated manifests changed, run:

```bash
git add .claude-plugin/plugin.json .agents/plugins/marketplace.json
git commit -m "chore: refresh generated manifests"
```

Expected: either no changes are present, or the refresh commit succeeds.

## Self-Review

- Spec coverage: Tasks cover repository docs, `AGENTS.md`, no `CLAUDE.md`,
  bucket layout, standard skill shape, generated runtime adapters, listing,
  validation, linking, ADR documentation, and final verification.
- Placeholder scan: no `TBD`, `TODO`, incomplete implementation notes, or
  unresolved decisions are present.
- Type consistency: script names, paths, bucket names, manifest names, and skill
  names are consistent across tasks.
