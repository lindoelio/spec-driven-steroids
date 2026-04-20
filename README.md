# Spec-Driven Steroids

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it is

`spec-driven-steroids` is a CLI plus template bundle for running a strict workflow inside AI coding tools:

```
requirements → design → tasks → implementation
```

It injects:
- Platform-specific agents, commands, or workflows
- Universal writing/implementation skills
- CLI validation commands for spec structure and traceability

## Supported Platforms

| Platform | Scope | Injection Type |
|----------|-------|-------------|
| Antigravity | project | `/spec-driven` command |
| Claude Code | project | `CLAUDE.md` |
| Gemini CLI | global | MCP servers, agents, commands |
| GitHub Copilot CLI | global | MCP servers, skills |
| GitHub Copilot for VS Code | global | MCP configuration |
| GitHub Copilot for JetBrains | global | MCP configuration |
| OpenCode | global | MCP configuration, skills |
| OpenAI Codex | project | Agent instructions |
| Qwen Code | global | MCP configuration, skills |

## Installation

```bash
npm install -g spec-driven-steroids
```

Requirements:
- Node.js `>=20`
- `pnpm` for local development

## CLI Usage

The CLI provides two command names:
- `sds` (short alias - recommended)
- `spec-driven-steroids` (full name)

### Inject Command

```bash
# Interactive injection (prompts for platform and options)
sds inject

# With flags
sds inject -p opencode
sds inject -p github-copilot --scope global
```

### Validate Commands

```bash
# Validate spec folder structure
sds validate structure <slug>

# Validate EARS requirements
sds validate requirements <path>

# Validate design structure and Mermaid
sds validate design <path>

# Validate task structure and traceability
sds validate tasks <path>

# Full end-to-end validation
sds validate spec <slug>
```

### Other Commands

```bash
# Show version
sds --version

# Show help
sds --help
```

## Skills Injected

The CLI injects these universal skills that work across all platforms:

### Core Spec-Driven Skills

| Skill | Purpose | Phase |
|-------|--------|-------|
| `spec-driven-requirements-writer` | Write EARS-format requirements | 1 |
| `spec-driven-technical-designer` | Create technical design with Mermaid | 2 |
| `spec-driven-task-decomposer` | Decompose into atomic tasks | 3 |
| `spec-driven-task-implementer` | Execute tasks from tasks.md | 4 |

### Universal Skills

| Skill | Purpose |
|-------|---------|
| `contextual-stewardship` | Knowledge graph for architectural decisions |
| `quality-grading` | Grade code/specs across 4 dimensions |
| `code-review-hardening` | Structured code review with self-repair |
| `universal-live-check` | Real-time validation framework |
| `long-running-work-planning` | Structured reasoning for complex tasks |
| `project-guidelines-writer` | Generate repository guidelines |
| `agent-work-auditor` | Audit agent-generated artifacts |

### Agents Injected

| Agent | Purpose |
|-------|---------|
| `spec-driven` | Main spec-driven workflow orchestrator |

## Spec Flow

### What gets generated

Spec-Driven planning writes artifacts to:

```
.specs/changes/<slug>/
├── requirements.md
├── design.md
└── tasks.md
```

### Workflow phases

1. **Requirements** - EARS-syntax requirements with stable IDs
2. **Design** - Mermaid diagrams, architecture sections
3. **Tasks** - Atomic implementation tasks with traceability
4. **Implementation** - Task execution with verification

### Quick start

1. Inject platform files into a repository:

```bash
sds inject
```

2. Generate project guidance:

```bash
/inject-guidelines
```

This creates: `AGENTS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, `SECURITY.md`

3. Start the spec flow:

- GitHub Copilot: `@spec-driven Add a rate limiter`
- OpenCode: use the `Spec-Driven` agent
- Antigravity: `/spec-driven`
- Codex: `/spec-driven Add a rate limiter`

4. Approve each planning phase, then move to implementation.

## Optional: Sequential-Thinking MCP

For complex long-running tasks, you can optionally add the sequential-thinking MCP server:

```bash
sds inject
# Select "Yes" when prompted to add sequential-thinking MCP
```

This enables structured reasoning to help agents break down complex problems.

## Package Layout

```
packages/
├── cli/                    # Main CLI package
│   ├── src/
│   │   ├── cli/           # Injection commands
│   │   ├── core/validate/ # Validation modules
│   │   └── context-stewardship/ # Knowledge graph
│   └── templates/          # Platform templates & skills
├── test-utils/             # Test fixtures and mocks
└── landing-page/         # Documentation site
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Useful commands:
- `pnpm typecheck` - Type check all packages
- `pnpm lint` - Lint all packages
- `pnpm test:coverage` - Run tests with coverage
- `pnpm changeset` - Create a changeset
- `pnpm changeset:version` - Version bump

## Repository Docs

- [AGENTS.md](AGENTS.md) - AI agent guidance
- [CONTRIBUTING.md](CONTRIBUTING.md) - PR process
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions
- [TESTING.md](TESTING.md) - Testing strategy
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [SECURITY.md](SECURITY.md) - Security policy

## License

MIT