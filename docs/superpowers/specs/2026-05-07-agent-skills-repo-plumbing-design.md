# Agent Skills Repo Plumbing Design

## Context

Create a standalone skills repository at `/Users/ravan/suse/repo/github/ravan/skills`.
The repository should borrow the proven organization from `refs/skills`, but the
portable Agent Skills format is the compatibility contract. Codex is the primary
coding agent, so `AGENTS.md` is the canonical repo instruction file.

## Goals

- Store skills in the standard Agent Skills shape: each skill is a directory with
  a `SKILL.md` file.
- Keep skill content agent-agnostic so Codex, Claude Code, Copilot, and other
  compatible agents can consume the same source folders.
- Provide generated or adapter-style metadata for agent-specific distribution.
- Make it easy to validate, list, link, and publish stable skills.
- Keep experimental, personal, and deprecated skills out of public manifests.

## Non-Goals

- Do not create a full package manager.
- Do not fork the Agent Skills specification.
- Do not make Claude-specific files canonical.
- Do not migrate existing skills in this first plumbing pass.

## Repository Structure

```text
skills/
├── AGENTS.md
├── CONTEXT.md
├── LICENSE
├── README.md
├── .claude-plugin/
│   └── plugin.json
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── docs/
│   ├── adr/
│   └── superpowers/
│       └── specs/
├── scripts/
│   ├── generate-plugin-json.sh
│   ├── link-skills.sh
│   ├── list-skills.sh
│   └── validate-skills.sh
└── skills/
    ├── engineering/
    ├── productivity/
    ├── misc/
    ├── personal/
    ├── in-progress/
    └── deprecated/
```

## Skill Buckets

Stable buckets:

- `engineering/`: coding and software delivery workflows.
- `productivity/`: reusable non-code workflows.
- `misc/`: stable but rarely used tools.

Private or unstable buckets:

- `personal/`: tied to local preferences or private workflows.
- `in-progress/`: drafts and experiments.
- `deprecated/`: retained for history but not distributed.

Only stable buckets appear in generated plugin manifests and the top-level
README index.

## Skill Standard

Every skill must follow the Agent Skills specification:

- The skill directory name must match the `name` field in `SKILL.md`.
- `SKILL.md` must contain YAML frontmatter followed by Markdown instructions.
- Required frontmatter fields are `name` and `description`.
- Skill names use lowercase letters, numbers, and hyphens only.
- Optional skill-local directories are `scripts/`, `references/`, and `assets/`.
- Large details should move out of `SKILL.md` into referenced files for
  progressive disclosure.

## Agent Instructions

`AGENTS.md` is canonical. It should contain repository rules for Codex and other
agents:

- Agent Skills spec compliance is mandatory.
- Stable skill manifests are generated from the repository source layout.
- Runtime-specific files are adapters.
- Do not promote `personal/`, `in-progress/`, or `deprecated/` skills.
- Prefer concise, portable instructions in `SKILL.md`.

No `CLAUDE.md` is created initially. Claude compatibility is handled by
`.claude-plugin/plugin.json`, not by making Claude-specific instructions the
repo source of truth.

## Distribution Metadata

The canonical skill list is the filesystem under stable buckets. Runtime files
are generated adapters:

- `.claude-plugin/plugin.json` lists stable skill directories for Claude-style
  plugin distribution.
- `.agents/plugins/marketplace.json` provides local Codex-oriented plugin
  discovery if useful, generated from the same stable list.

Generated manifests must not include private or unstable buckets.

## Scripts

- `scripts/list-skills.sh`: print all `SKILL.md` paths.
- `scripts/validate-skills.sh`: enforce Agent Skills naming and frontmatter
  rules using local checks, and use `skills-ref validate` when available.
- `scripts/generate-plugin-json.sh`: rebuild runtime manifests from stable
  buckets.
- `scripts/link-skills.sh`: link stable skills into local agent skill folders.
  Codex should be the default target. Claude can be an optional target.

Scripts should be self-contained Bash, fail clearly, and avoid mutating files
outside the repo except when explicitly linking skills into a user-selected
agent directory.

## Documentation

- `README.md` explains the repo purpose, layout, validation, and install/link
  workflow.
- Each bucket has a `README.md` with a one-line description and linked skills.
- `CONTEXT.md` defines repository vocabulary.
- `docs/adr/0001-agent-skills-standard-is-canonical.md` records the decision
  that the Agent Skills spec is canonical and runtime manifests are adapters.

## Testing And Verification

The implementation is complete when:

- `git status` shows only intentional new files.
- `scripts/list-skills.sh` runs successfully.
- `scripts/validate-skills.sh` runs successfully against any placeholder skills
  that exist.
- `scripts/generate-plugin-json.sh` produces manifests that include only stable
  buckets.
- `AGENTS.md` exists and `CLAUDE.md` does not exist unless explicitly requested.

## Open Decisions

No open decisions remain for the initial plumbing. Future work can decide how to
publish the repo externally and whether to add packaging beyond generated
manifests.
