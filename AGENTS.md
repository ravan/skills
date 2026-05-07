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
- Keep stable skills under `skills/engineering`, `skills/productivity`,
  `skills/linkedin`, or `skills/misc`.
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
