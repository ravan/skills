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
