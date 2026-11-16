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

The CLI works from repository evidence: `AGENTS.md`, `CONVENTIONS.md`, the
approved spec artifacts, and the existing code. It keeps no second memory
besides the context the host environment already provides.

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
# Stable release (TypeScript 0.23.0, unchanged)
npm install -g spec-driven-steroids
```

The native preview has no npm line yet. Download the binary for your platform
from the GitHub prerelease, verify it against `checksums.txt`, and put it on
your `PATH`:

```bash
VERSION=1.0.0-next.1
OS=darwin   # linux, or windows with the .exe suffix
ARCH=arm64  # amd64
TAG="v${VERSION}"
ASSET="sds-${OS}-${ARCH}"

curl -fsSL -o "${ASSET}" "https://github.com/lindoelio/spec-driven-steroids/releases/download/${TAG}/${ASSET}"
curl -fsSL -o checksums.txt "https://github.com/lindoelio/spec-driven-steroids/releases/download/${TAG}/checksums.txt"
shasum -a 256 -c --ignore-missing checksums.txt
chmod +x "${ASSET}" && sudo mv "${ASSET}" /usr/local/bin/sds
sds --version
```

Windows publishes `sds-windows-<arch>.exe` and verifies the checksum with
`Get-FileHash`. The npm `@next` line follows once the npm account is ready;
the GitHub prerelease is the preview channel until then.

The CLI is a single native binary with no runtime dependency: the binary needs no Node.js runtime and ships no dependency tree. The npm package installs the binary that matches your operating system and architecture through a thin Node launcher; the launcher is the only JavaScript that runs, and the binary does the work.

Requirements:
- A supported operating system and architecture: Linux, macOS, or Windows on x64 or arm64

The CLI provides two command names:
- `sds` (short alias - recommended)
- `spec-driven-steroids` (full name)

### How the npm package installs the binary

The npm package is a main package that ships the installer and a thin
launcher; it has no JavaScript CLI entrypoint. It declares the platform
packages as optional dependencies, and the registry resolves exactly one of
them for your host, because each platform package declares the operating
system and the architecture it applies to in npm's own vocabulary.

The installer copies the binary out of the platform package the registry
resolved, verifies it against the digest published with that package, and
places it only when the digest matches. It performs no network access of its
own: the registry is the only transport.

| Platform package | Binary inside the package |
|-------------------|---------------------------|
| `@spec-driven-steroids/linux-x64` | `bin/sds` |
| `@spec-driven-steroids/linux-arm64` | `bin/sds` |
| `@spec-driven-steroids/darwin-x64` | `bin/sds` |
| `@spec-driven-steroids/darwin-arm64` | `bin/sds` |
| `@spec-driven-steroids/win32-x64` | `bin/sds.exe` |
| `@spec-driven-steroids/win32-arm64` | `bin/sds.exe` |

The package name is the host identity npm reports, so the platform package
your host resolves is:

```bash
node -p "process.platform + '-' + process.arch"
```

### Installing the binary manually

When the installation scripts are disabled (`npm install --ignore-scripts`, or
a policy that blocks them), the installer never runs and therefore cannot print
anything. The binary still reaches your machine inside the platform package the
registry resolved, at:

```text
node_modules/@spec-driven-steroids/<platform>-<arch>/bin/sds
```

Link it yourself with the package name your host resolves:

```bash
# Linux and macOS
npm link @spec-driven-steroids/linux-x64

# Windows
npm link @spec-driven-steroids/win32-x64
```

`npm link` creates the symlink in the global npm bin directory, so `sds` and
`spec-driven-steroids` are on your PATH afterwards. On Linux and macOS the
same link can be created by hand:

```bash
ln -sf "$(npm root)/@spec-driven-steroids/linux-x64/bin/sds" "$(npm prefix -g)/bin/sds"
```

## CLI Usage

The command surface is `inject`, `clean`, `doctor`, `repair`, `uninstall`, `templates`, `validate`, and `package`, together with `--version` and `--help`. The command names, argument names, and exit codes match the previous release, except the removed `stewardship` command.

### Artifact Root

Every managed artifact lives in one predictable directory:

| Scope | Artifact root |
|-------|---------------|
| Project | `.agents/` inside the working directory |
| User (global) | `~/.agents/` under the home directory |

Both roots use the same internal layout, so a skill installed at user scope and the same skill installed at project scope occupy structurally identical paths:

```text
.agents/
├── skills/<skill-name>/SKILL.md
├── skills/<skill-name>/references/*
├── agents/<agent-name>.md
└── commands/<command-name>.md
```

A project artifact shadows a user artifact of the same name. The CLI owns only the paths it records in an install manifest and never removes content it did not create.

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

# Render the portable distribution package and the marketplace catalogs
sds package --out ./dist/sds-distribution
sds package --dry-run --json

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

```
/inject-guidelines
```

This reviews `AGENTS.md`, `CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`, and `SECURITY.md`, creating missing files unless explicitly skipped. Existing `CONTRIBUTING.md` and `STYLEGUIDE.md` content is merged into `CONVENTIONS.md` at the section level, preserving the original wording of user-authored rules. Existing documents receive only justified, targeted updates; files that need no changes are not rewritten. Guidelines are ordinary Markdown without generator branding or ownership markers. Legacy managed-section delimiters are removed without regenerating their content.

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

## Package Contents

```
sds                # Native CLI binary for the resolved platform
templates/         # Platform templates and universal skills
README.md
LICENSE
```

The npm package resolves exactly one platform package for your operating system and architecture and installs the binary it ships, verified against the digest published with that package. The binary needs no Node.js runtime; the launcher needs the Node already present for npm.

## Links

- npm: https://www.npmjs.com/package/spec-driven-steroids
- Repository: https://github.com/lindoelio/spec-driven-steroids
- Issues: https://github.com/lindoelio/spec-driven-steroids/issues

## License

MIT
