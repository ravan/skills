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
