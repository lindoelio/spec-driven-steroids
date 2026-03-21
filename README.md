# Spec-Driven Steroids

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it is

`spec-driven-steroids` is a CLI plus MCP server plus template bundle for running a strict workflow inside AI coding tools:

`requirements -> design -> tasks -> implementation`

It injects:
- platform-specific agents, commands, or workflows
- universal writing/implementation skills
- MCP validation tools for spec structure and traceability

## Supported platforms

- GitHub Copilot for VS Code
- GitHub Copilot for JetBrains
- OpenCode
- Google Antigravity
- OpenAI Codex
- Claude Code

## What gets generated

Spec-Driven planning writes artifacts to:

```text
specs/changes/<slug>/
  requirements.md
  design.md
  tasks.md
```

The workflow is built around:
- EARS requirements
- Mermaid design diagrams
- atomic implementation tasks
- requirement/design/task traceability

## Installation

```bash
npm install -g spec-driven-steroids
```

Requirements:
- Node.js `>=20`
- `pnpm` for local development

## Quick start

1. Inject platform files into a repository:

```bash
spec-driven-steroids inject
```

2. Generate project guidance first:

- use `/inject-guidelines` in supported tools
- this creates `AGENTS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, and `SECURITY.md`

3. Start the spec flow:

- GitHub Copilot: `@spec-driven Add a rate limiter to the API`
- OpenCode: use the `Spec-Driven` agent
- Antigravity: `/spec-driven`
- Codex: `/spec-driven Add a rate limiter to the API`

4. Approve each planning phase as it completes, then move to implementation.

## Validation tools

The bundled MCP server provides 5 tools:

| Tool | Purpose |
| --- | --- |
| `verify_spec_structure` | Validate spec folder structure |
| `verify_requirements_file` | Validate EARS requirements |
| `verify_design_file` | Validate design structure and Mermaid usage |
| `verify_tasks_file` | Validate task structure and traceability |
| `verify_complete_spec` | Validate the full spec end to end |

## Package layout

```text
packages/
  cli/
    src/cli/        CLI injection and validation commands
    src/mcp/        MCP validation server
    templates/      Platform wrappers and universal skills
  test-utils/       Shared fixtures and helpers
  landing-page/     Documentation site
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Useful commands:
- `pnpm typecheck`
- `pnpm test:coverage`
- `pnpm changeset`
- `pnpm changeset:version`

## Release flow

This repo publishes the `spec-driven-steroids` npm package with Changesets and GitHub Actions trusted publishing.

Typical release steps:

```bash
pnpm changeset
pnpm changeset:version
pnpm test
pnpm build
git push origin main
git tag -a v<version> -m "release v<version>"
git push origin v<version>
```

The publish workflow runs from `.github/workflows/publish.yml` and uses npm trusted publishing through GitHub Actions OIDC, so no long-lived npm token is required in the repository.

## Repository docs

- `AGENTS.md`
- `CONTRIBUTING.md`
- `STYLEGUIDE.md`
- `TESTING.md`
- `ARCHITECTURE.md`
- `SECURITY.md`

## License

MIT
