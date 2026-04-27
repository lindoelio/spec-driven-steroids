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
- A knowledge graph for architectural decisions and business rules

## Supported Platforms

| Platform | Scope | Injection Type |
|----------|-------|-------------|
| Antigravity | project | `/spec-driven` workflow |
| Claude Code | project | Agents, commands, skills |
| Gemini CLI | global / project | Agents, commands, skills |
| GitHub Copilot CLI | user / project | Agents, commands, skills |
| GitHub Copilot for VS Code | global / project | Agents, prompts, skills |
| GitHub Copilot for JetBrains | project | Agents, prompts, skills |
| OpenCode | global / project | Agents, commands, skills |
| OpenAI Codex | project | Agents, commands, skills |
| Qwen Code | user / project | Agents, commands, skills |

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
# Interactive injection (prompts for platform and scope)
sds inject
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
# Clean globally injected steroids
sds clean --global

# Show version
sds --version

# Show help
sds --help
```

### Stewardship Commands

Manage a knowledge graph of architectural decisions, business rules, and workflow conventions extracted from spec files:

```bash
# Report available stewardship capabilities
sds stewardship capabilities

# Search for rules in the knowledge graph
sds stewardship retrieve <query> --domain architecture

# Persist a new rule
sds stewardship store architecture --content "Use hexagonal architecture"

# Extract decision candidates from a design.md or requirements.md
sds stewardship extract .specs/changes/my-feature/design.md

# Show rule provenance and version history
sds stewardship trace <ruleId>

# Retrieve context for a spec phase
sds stewardship inject design

# List, deprecate, or archive rules
sds stewardship manage list
sds stewardship manage deprecate --ruleId <ruleId>
```

These rules are automatically referenced by each spec-driven skill to give agents awareness of established project patterns.

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
| `long-running-work-planning` | Durable checkpointed execution for long tasks |
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

## Long-Running Work

For complex long-running tasks, SDS injects `long-running-work-planning`. It keeps agents working through durable artifacts, task status updates, checkpoints, and verification.

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
