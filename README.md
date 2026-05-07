# Skills

Portable Agent Skills for coding, productivity, and local workflows.

The repository follows the Agent Skills standard: each skill is a directory with
a `SKILL.md` file containing `name` and `description` frontmatter plus Markdown
instructions.

## Quickstart (30-second setup)

1. Run the skills.sh installer:

```bash
npx skills@latest add ravan/skills
```

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
    ├── linkedin/
    ├── misc/
    ├── personal/
    ├── in-progress/
    └── deprecated/
```

## Stable Skills

Stable skills live in:

- `skills/engineering`
- `skills/productivity`
- `skills/linkedin`
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
