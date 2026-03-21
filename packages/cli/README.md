# Spec-Driven Steroids

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What it is

`spec-driven-steroids` is the published CLI package for:
- injecting platform-specific agents, commands, and workflows
- installing universal Spec-Driven skills
- exposing an MCP server for spec validation

It supports a strict workflow:

`requirements -> design -> tasks -> implementation`

## Supported platforms

- GitHub Copilot for VS Code
- GitHub Copilot for JetBrains
- OpenCode
- Google Antigravity
- OpenAI Codex

## Installation

```bash
npm install -g spec-driven-steroids
```

Requirements:
- Node.js `>=20`

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

## Package contents

```text
dist/          Built CLI and MCP server
templates/     Platform wrappers and universal skills
README.md
LICENSE
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Links

- Repository: `https://github.com/lindoelio/spec-driven-steroids`
- Issues: `https://github.com/lindoelio/spec-driven-steroids/issues`

## License

MIT
