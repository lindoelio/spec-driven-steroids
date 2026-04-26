# Spec-Driven Steroids CLI

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What it is

`spec-driven-steroids` is the published CLI package for injecting a strict Spec-Driven workflow into AI coding tools:

```
requirements → design → tasks → implementation
```

It provides:
- Platform-specific injection (agents, commands, workflows)
- Universal skills across all platforms
- CLI validation commands for specs

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

The CLI provides two command names (work identically):
- `sds` (recommended - short alias)
- `spec-driven-steroids` (full name)

## CLI Usage

### inject

Inject platform-specific files into the current repository:

```bash
# Interactive - prompts for platform and options
sds inject

# With flags
sds inject -p opencode
sds inject -p github-copilot --scope global
sds inject -p gemini-cli --scope project
```

Flags:
- `-p, --platform <platform>` - Target platform
- `-s, --scope <scope>` - Injection scope (`project` or `global`)
- `-y, --yes` -Skip prompts, use defaults

### validate

Validate spec artifacts:

```bash
sds validate structure <slug>          # Spec folder structure
sds validate requirements <path>        # EARS requirements
sds validate design <path>              # Mermaid diagrams
sds validate tasks <path>               # Task traceability
sds validate spec <slug>               # Full validation
```

### Other commands

```bash
sds --version    # Show version
sds --help      # Show help
```

## Skills Injected

### Core Spec-Driven Skills

| Skill | Purpose | Phase |
|-------|--------|-------|
| `spec-driven-requirements-writer` | Write EARS-format requirements | 1 |
| `spec-driven-technical-designer` | Create technical design | 2 |
| `spec-driven-task-decomposer` | Decompose into tasks | 3 |
| `spec-driven-task-implementer` | Execute tasks | 4 |

### Universal Skills

| Skill | Purpose |
|-------|---------|
| `contextual-stewardship` | Knowledge graph for decisions |
| `quality-grading` | Grade code/specs quality |
| `code-review-hardening` | Code review with self-repair |
| `universal-live-check` | Real-time validation |
| `long-running-work-planning` | Durable checkpointed execution for long tasks |
| `project-guidelines-writer` | Generate guidelines |
| `agent-work-auditor` | Audit agent output |

### Agents

| Agent | Purpose |
|-------|---------|
| `spec-driven` | Main workflow orchestrator |

## Package Contents

```
dist/              # Built CLI and validation modules
templates/          # Platform templates and universal skills
README.md
LICENSE
```

## Quick Start

```bash
# 1. Inject platform files
sds inject

# 2. Generate project guidance (optional)
/inject-guidelines

# 3. Run spec flow
# - Copilot: @spec-driven Add a feature
# - OpenCode: use Spec-Driven agent
# - Antigravity: /spec-driven
# - Codex: /spec-driven Add a feature
```

## Links

- npm: https://www.npmjs.com/package/spec-driven-steroids
- Repository: https://github.com/lindoelio/spec-driven-steroids
- Issues: https://github.com/lindoelio/spec-driven-steroids/issues

## License

MIT
