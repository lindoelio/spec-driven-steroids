# Spec-Driven Steroids

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it is

`spec-driven-steroids` is an opt-in planning layer for AI coding tools. When invoked, it always requires a written plan and human approval before implementation.

```
brief (default): brief → approval → implementation → compact review
full (high risk): requirements → design → tasks → Red Team Review → implementation → Code Review
```

Direct implementation remains the host harness's default behavior. Use SDS when the change should be specified and approved first.

It injects:
- Platform-specific agents, commands, or workflows
- Universal writing/implementation skills
- CLI validation commands for spec structure and traceability
- A knowledge graph for architectural decisions and business rules

## Supported Platforms

| Platform | Scope | Injection Type |
|----------|-------|-------------|
| Antigravity IDE | global / project | Skills (`/spec-driven`) |
| Antigravity CLI (AGY) | global / project | Skills (`/spec-driven`) |
| Claude Code | project | Agents, commands, skills |
| Cline | user / project | Agents, commands, skills |
| Gemini CLI | global / project | Agents, commands, skills |
| GitHub Copilot CLI | user / project | Agents, commands, skills |
| GitHub Copilot for VS Code | global / project | Agents, prompts, skills |
| GitHub Copilot for JetBrains | project | Agents, prompts, skills |
| OpenCode | global / project | Agents, commands, skills |
| OpenAI Codex | project | Agents, command skills, skills |
| Qoder CLI / IDE | user / project | Agents, commands, skills |
| Qwen Code | user / project | Agents, commands, skills |

## Installation

```bash
npm install -g spec-driven-steroids
```

Requirements:
- Node.js `>=20`

The CLI provides two command names:
- `sds` (short alias - recommended)
- `spec-driven-steroids` (full name)

## CLI Usage

### Inject Command

```bash
# Interactive injection (prompts for platform and scope)
sds inject

# Non-interactive injection for CI or containers
sds inject --platform opencode --scope global --yes

# Preview without writing, or emit machine-readable output
sds inject --platform opencode --scope project --yes --dry-run
sds inject --platform opencode --scope project --yes --json

# Choose the template source explicitly
sds inject --platform opencode --scope project --yes --templates bundled
```

`--platform` accepts a comma-separated list. `--scope` accepts `global` or `project`.
`--backup` copies an existing platform root under the SDS config directory
(`$SDS_CONFIG_DIR/backups`, default `~/.config/spec-driven-steroids/backups`,
`%APPDATA%\spec-driven-steroids\backups` on Windows) before writing. `--dry-run` never writes files
or install manifests. Exit codes: `0` success, `1` validation/partial failure, `2` usage error.

### Validate Commands

```bash
# Validate spec folder structure
sds validate structure <slug>

# Validate a lightweight brief
sds validate brief <path>

# Validate EARS requirements
sds validate requirements <path>

# Validate design structure and Mermaid
sds validate design <path>

# Validate task structure and traceability
sds validate tasks <path>

# Auto-detect and validate a brief or full spec
sds validate spec <slug>

# Validate every spec in one aggregated result
sds validate all --format json
```

Mermaid validation is structural and best-effort; it checks diagram type and sequence participant references but is not a full Mermaid parser.

### Other Commands

```bash
# Clean globally injected steroids
sds clean --global

# Clean project-level artifacts recorded in the install manifest
sds clean --project

# Preview cleanup or force removal of modified files
sds clean --global --dry-run
sds clean --global --yes --force

# Inspect, repair, or remove manifest-tracked installs
sds doctor
sds repair --project
sds uninstall --platform opencode --scope project --yes

# Inspect the resolved template source
sds templates info
sds templates info --json

# Show version
sds --version

# Show help
sds --help
```

### Validation

```bash
# Validate every spec in one aggregated result (useful in CI)
sds validate all --format json

# Validate only specs changed since a git ref
sds validate all --changed origin/main
```

`--changed` exits `2` when the ref cannot be resolved; shallow CI clones may need a
full history (`fetch-depth: 0`). When the ref resolves but no spec changed, it exits `0`
with an empty result.

### Stewardship Commands

Manage a knowledge graph of architectural decisions, business rules, and workflow conventions extracted from spec files:

```bash
# Report available stewardship capabilities
sds stewardship capabilities

# Search for rules in the knowledge graph
sds stewardship retrieve <query> --domain architecture [--scope <project-id>] [--global]

# Persist a project-scoped rule by default
sds stewardship store architecture --content "Use hexagonal architecture"

# Persist a truly universal rule
sds stewardship store workflow --content "Run typecheck before completion" --global

# Resolve a conflicting rule explicitly
sds stewardship store architecture --content "Use PostgreSQL" --on-conflict override

# Extract decision candidates from a design.md or requirements.md
sds stewardship extract .specs/changes/my-feature/design.md

# Show rule provenance and version history
sds stewardship trace <ruleId> [--scope <project-id>] [--global]

# Retrieve context for a spec phase
sds stewardship inject design [--scope <project-id>] [--global]

# List, deprecate, archive, or move rules
sds stewardship manage list
sds stewardship manage deprecate --ruleId <ruleId> [--scope <project-id>] [--global]
sds stewardship manage move --ruleId <ruleId> --scope <project-id>
```

Rules are project-scoped by default and only fall back to global rules during retrieval. Use `--global` only for memories that are safe across unrelated repositories.

## Skills Injected

The CLI injects these universal skills that work across all platforms:

### Core Spec-Driven Skills

| Skill | Purpose | Phase |
|-------|--------|-------|
| `spec-driven-brief-planner` | Write, approve, implement, and review a compact brief | Brief lane |
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

### Workflow lanes

| Lane | Use When | Artifact | Approval |
|------|----------|----------|----------|
| `brief` | Default bounded change | `brief.md` | One approval before implementation |
| `full` | High-risk, cross-boundary, migration, security, or public-contract change | `requirements.md`, `design.md`, `tasks.md` | Approval between every planning phase |

SDS has no direct lane. Use the host harness without SDS when no planning artifact or approval is needed.

### What gets generated

Spec-Driven planning writes artifacts to:

```
.specs/changes/<slug>/
brief lane:
└── brief.md

full lane:
├── requirements.md
├── design.md
└── tasks.md
```

The two layouts are mutually exclusive. `sds validate structure` and `sds validate spec` detect the lane automatically.

### Full workflow phases

1. **Requirements** - EARS-syntax requirements with stable IDs
2. **Design** - Mermaid diagrams, architecture sections
3. **Tasks** - Execute non-exhaustive Discovery Targets, record evidence, then produce stable atomic tasks
4. **Implementation** - Task execution with verification

### Quick start

1. Inject platform files into a repository:

```bash
sds inject
```

2. Generate project guidance:

```
/inject-guidelines
```

This creates: `AGENTS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, `SECURITY.md`

3. Start the spec flow:

- GitHub Copilot: `@spec-driven Add a rate limiter`
- OpenCode: use the `Spec-Driven` agent
- Cline: use the `Spec-Driven` agent or `/spec-driven`
- Antigravity IDE: `/spec-driven`
- Antigravity CLI (AGY): `/spec-driven`
- Codex: select the `spec-driven` skill with `/skills` or mention `$spec-driven`

4. Approve the single brief or each full-lane planning phase, then move to implementation.

## Long-Running Work

For complex long-running tasks, SDS injects `long-running-work-planning`. It keeps agents working through durable artifacts, task status updates, checkpoints, and verification.

## Package Contents

```
dist/              # Built CLI and validation modules
templates/          # Platform templates and universal skills
README.md
LICENSE
```

## Links

- npm: https://www.npmjs.com/package/spec-driven-steroids
- Repository: https://github.com/lindoelio/spec-driven-steroids
- Issues: https://github.com/lindoelio/spec-driven-steroids/issues

## License

MIT
