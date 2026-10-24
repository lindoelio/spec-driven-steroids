# Spec-Driven Steroids

Inject Spec-Driven Development into AI coding tools without building a new UI.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it is

`spec-driven-steroids` is an opt-in planning layer for AI coding tools. When invoked, it always requires a written plan and human approval before implementation.

```
brief (default): brief → approval → implementation → compact review
full (deliberate): requirements → design → tasks → Red Team Review → implementation → Code Review
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
| Cline | user / project | Skills (`/spec-driven`) |
| Gemini CLI | global / project | Agents, commands, skills |
| GitHub Copilot CLI | user / project | Agents, commands, skills |
| GitHub Copilot for VS Code | global / project | Agents, prompts, skills |
| GitHub Copilot for JetBrains | project | Agents, prompts, skills |
| MiniMax Code | global / project | Skills (`/skill:spec-driven`) |
| OpenCode | global / project | Agents, commands, skills |
| OpenAI Codex | project | Agents, command skills, skills |
| Qoder CLI / IDE | user / project | Agents, commands, skills |
| Qwen Code | user / project | Agents, commands, skills |

MiniMax Code receives skills only. Project scope writes to `.minimax/skills`, the workspace directory its runtime reads with the highest priority. Global scope writes to `~/.agents/skills`, the shared Agent Skills directory. Cleanup removes only the SDS-owned skill directories and leaves other skills in that shared location untouched.

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

# Aggregate every spec in one result
sds validate all --format json
```

Mermaid validation is structural and best-effort; it checks diagram type and sequence participant references but is not a full Mermaid parser.

Brief validation warns when task file paths lack matching Repository Evidence entries or a Verify field lacks a backticked command or `Check: <action> => <observable outcome>`. These warnings do not invalidate existing briefs or change successful aggregate exit codes. New plans must resolve them before approval; syntactic checks alone do not prove correctness.

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

Remote templates are preferred by default. If a remote bundle or its intact cache lacks a required skill or planner reference, SDS falls back to the bundled templates. `sds templates info --json` reports the selected source and fallback reason.

After upgrading, re-run `sds inject` for the intended platform and scope, or `sds repair --project` for a manifest-tracked project install. This installs the new planner skill together with its updated entry point. Review local customizations first: injection and repair can overwrite installed files. Existing installations do not change until refreshed.

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

Retrieval and conflict detection use keyword overlap plus recency/confidence scoring. They are lexical, not embedding-based, so contradictions that share no vocabulary are not detected automatically. Phase injection returns all active rules in the phase's domains.


## Skills Injected

The CLI injects these universal skills that work across all platforms:

### Core Spec-Driven Skills

| Skill | Purpose | Phase |
|-------|--------|-------|
| `spec-driven-planner` | Own lane selection, approvals, transitions, and portable orchestration | Both lanes |
| `spec-driven-brief-planner` | Write, approve, implement, and review a compact brief | Brief lane |
| `spec-driven-requirements-writer` | Write EARS-format requirements | 1 |
| `spec-driven-technical-designer` | Create technical design with Mermaid | 2 |
| `spec-driven-task-decomposer` | Decompose into atomic tasks | 3 |
| `spec-driven-task-implementer` | Execute tasks from tasks.md | 4 |
| `spec-driven-shared-protocol` | Supply context, validation, and quality-gate protocols | Both lanes |

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
| `spec-driven` | Route to the authoritative planner skill, where native agents are supported |

Skills own the workflow rules. Agents, commands, and entry skills are thin routers to `spec-driven-planner`; the skill wins if their instructions conflict. Native agents and sub-agent tools are not required.

## Spec Flow

### Workflow lanes

| Lane | Use When | Artifact | Approval |
|------|----------|----------|----------|
| `brief` | Default bounded change | `brief.md` | One approval before implementation |
| `full` | Explicitly requested, or separate requirements/design/tasks reviews offer a concrete, evidence-backed advantage | `requirements.md`, `design.md`, `tasks.md` | Approval between every planning phase and before implementation |

SDS has no direct lane. Use the host harness without SDS when no planning artifact or approval is needed.

Brief is the genuine default, not a low-risk keyword filter. A migration, security fix, or public-contract change does not automatically require full. The planner investigates affected behavior and uncertainty, then recommends full only when separate reviews would help resolve them. It explains that advantage and asks for confirmation; the ordinary brief path has only its artifact-approval stop.

Use `lane:brief` or `lane:full` in your request to choose explicitly. Existing artifacts resume their lane unless you approve a transition. Every plan records a lane rationale; choosing brief despite a full recommendation also records the accepted residual risk. Destructive brief work must include a credible, executable recovery strategy and its verification; otherwise it requires full mitigation review. Neither lane replaces host permissions or authorizes destructive actions by itself.

### Larger work and lane transitions

A brief contains 1–5 requirements and 1–8 tasks, including tests. Larger work is split into coherent sibling briefs with separate slugs, verification, and approvals—not automatically escalated by task or file count. Optional `**Slice:** N/M` metadata identifies ordering; Intent and Non-Goals name sibling slugs and dependencies. Future slices are not implicitly approved.

Lane transitions require approval before moving artifacts. Brief → full preserves the original brief under `.archive/`, carries evidence forward, and restarts requirements approval; completed implementation is not erased or automatically re-approved. Full → brief is offered only before requirements approval. Archive snapshots are never overwritten, and transition approval is not implementation approval.

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

The active layouts are mutually exclusive. Inactive snapshots may coexist under `.archive/`. `sds validate structure` and `sds validate spec` detect the lane automatically and report empty or mixed active layouts explicitly.

### Full workflow phases

1. **Requirements** - EARS-syntax requirements with stable IDs
2. **Design** - Mermaid diagrams, architecture sections
3. **Tasks** - Execute non-exhaustive Discovery Targets, record evidence, then produce stable atomic tasks
4. **Implementation** - Task execution with verification

Human approval to enter implementation authorizes the approved plan's pending tasks without per-task permission stops. An explicit task or phase request takes precedence and limits execution. A standalone implementer invocation defaults to one task after confirming implementation approval. Resumption preserves the approved scope and verifies in-progress work before completion.

Brief ends with one compact review; full retains Red Team Review and Code Review. Use an independent reviewer when spawning is available, otherwise disclose an inline adversarial self-review. Required verification must be observed passing: unavailable tools or failed checks cannot be turned into approval with a limitation note.

### Quick start

1. Inject platform files into a repository:

```bash
sds inject
```

2. Generate or review project guidance:

```bash
/inject-guidelines
```

This reviews `AGENTS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, and `SECURITY.md`, creating missing files unless explicitly skipped. Existing documents receive only justified, targeted updates; files that need no changes are not rewritten. Guidelines are ordinary Markdown without generator branding or ownership markers. Legacy managed-section delimiters are removed without regenerating their content.

3. Start the spec flow:

- GitHub Copilot: `@spec-driven Add a rate limiter`
- OpenCode: use the `Spec-Driven` agent
- Cline: `/spec-driven`
- Antigravity IDE: `/spec-driven`
- Antigravity CLI (AGY): `/spec-driven`
- MiniMax Code: `/skill:spec-driven`
- Codex: select the `spec-driven` skill with `/skills` or mention `$spec-driven`

4. Approve the single brief or each full-lane planning phase, then move to implementation.

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
- `pnpm lint` - Lint all packages with Biome
- `pnpm test:coverage` - Run tests with enforced coverage thresholds
- `pnpm pack:check` - Build, pack, install the tarball, and run `sds --version`
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
