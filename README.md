# Spec-Driven Steroids 💪

> Inject Spec-Driven workflow into your favorite AI Agents. Rigorous. Simple. Frictionless.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Vision

**Spec-Driven Steroids** is a modular toolkit designed to bring discipline to
AI-powered software engineering. It **injects** high-standard workflows (SDD)
directly into the native environments of your favorite AI tools.

- **Platform Native**: No new UI to learn. Work entirely within your existing AI
  chat.
- **Strict Enforcement**: Uses **Model Context Protocol (MCP)** to
  programmatically validate AI-generated specs.
- **Rigorous Flow**: Requirements (EARS) → Technical Design (Mermaid) → Atomic
  Tasks → Implementation.

**Supported Platforms:**

- GitHub Copilot (VS Code and JetBrains IDEs)
- Google Antigravity
- OpenCode

We are actively working on expanding support and are open to contributions. If your favorite AI tool isn't supported yet, we'd love to hear from you!

---

## Future Roadmap

- [ ] **Codex** - Support for OpenAI's Codex integration
- [ ] **Claude Code** - Anthropic's Claude Code integration
- [ ] **KiloCode** - Support for KiloCode AI coding assistant
- [ ] **Custom Templates** - User-defined spec templates

---

## Core Pillars

1. **The Brain (Standards)**: Universal Markdown-based Skills and Agent Profiles
   that define specialized roles like `@spec-driven`.
2. **The Enforcer (MCP)**: A background service with 5 comprehensive validation
   tools for EARS syntax, Mermaid diagrams, file structure, and traceability.
3. **The Injector (CLI)**: A command-line interface with MCP server selection
   and spec injection capabilities.

---

## Architecture

```
packages/
 ├── mcp/                 # Node.js MCP Server (The Enforcer)
 ├── standards/           # Markdown templates for Skills & Agents (The Brain)
 └── cli/                 # Terminal interface for injections (The Injector)
```

---

## Getting Started

### 1. Installation

#### Option A: Install from npm (Recommended)

```bash
npm install -g spec-driven-steroids
```

This installs the CLI globally for easy access from any directory.

#### Option B: Build from Source

You need to have Node.js and pnpm installed (npm install -g pnpm && pnpm setup). Then run:

```bash
# Clone the repository
git clone https://github.com/lindoelio/spec-driven-steroids.git
cd spec-driven-steroids

# Install dependencies
pnpm install

# Build the toolkit
pnpm build

# Link the CLI globally (optional, for easier access)
cd packages/cli
pnpm link
```

### 2. Inject into your Project

Navigate to your target repository and run:

```bash
spec-driven-steroids inject
```

**Select your platforms** (GitHub Copilot, Antigravity, or OpenCode) to scaffold the necessary `.github/`, `.agent/`, or `.opencode/` configurations.

---

## Usage

### 1. Generate Project Guidelines (Recommended First)

Before using the spec-driven flow, we recommend generating project guidelines to ensure consistency and best practices.

Use the `/inject-guidelines` command to automatically generate comprehensive project documentation with zero configuration.

**GitHub Copilot for VS Code and JetBrains IDEs:**

> `/inject-guidelines` _(Analyzes repository and generates AGENTS.md,
> CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, SECURITY.md)_

**Google Antigravity:**

> `/inject-guidelines`

**OpenCode:**

> `/inject-guidelines`

**What it does:**

- Analyzes representative codebase files to understand your project
- Generates 6 guideline documents using the Document Responsibility Matrix
- Prompts before overwriting existing files
- Includes managed section markers for future updates
- Creates cross-references between documents to avoid duplication

### 2. GitHub Copilot

Once injected, you have access to specialized **Custom Agents** directly in your
chat.

- **Plan a Feature**:
  > `@spec-driven I want to add a rate limiter to my API.` _(The agent generates
  > a slug and creates `specs/changes/rate-limiter/requirements.md`,
  > `design.md`, `tasks.md`)_

- **Implement**:
  > `@copilot Implement the rate limiter following the tasks in specs/changes/rate-limiter/tasks.md.`
  > _(The agent follows the validated task breakdown with proper traceability)_

- **JetBrains IDEs**: The same agents work in **GitHub Copilot for JetBrains**
  (IntelliJ IDEA, PyCharm, WebStorm, Rider, etc.) — no plugin installation
  needed. Copilot Chat uses the `.jetbrains/` folder templates automatically.

### 3. Google Antigravity

Use native **Workflows** to orchestrate the entire process.

- **Run Full Loop**:
  > `/spec-driven` _(Guides you through Requirements → Design → Tasks → Code,
  > saving everything in `specs/changes/<slug>/`)_

### 4. OpenCode

Spec-Driven Steroids injects a **Primary Agent** and **Skills** for OpenCode.

- **Plan a Feature with Spec-Driven Agent**:
  > Switch to the **Spec-Driven** agent (press Tab) and describe your feature.
  > _The agent guides you through:_ _1. **Requirements** - EARS format with MCP
  > validation_ _2. **Technical Design** - Mermaid diagrams with traceability_
  > _3. **Task Decomposition** - Atomic, numbered implementation tasks_ _4.
  > **Build Agent Handoff** - Recommended switch to Build agent for
  > implementation_

- **Implement with Build Agent**:
  > After task decomposition, the spec-driven agent recommends switching to the
  > **Build** agent. The Build agent reads the spec-driven skill file and
  > implements the following:
  >
  > - Task status workflow (update tasks.md after each task)
  > - Traceability (REQ-X, DES-X in commits)
  > - Implementation best practices

---

## MCP Validation Tools

The MCP server provides 5 comprehensive validation tools:

| Tool                       | Purpose              | Validates                                                            |
| -------------------------- | -------------------- | -------------------------------------------------------------------- |
| `verify_spec_structure`    | Folder structure     | Directory exists, required files present                             |
| `verify_requirements_file` | Requirements content | Sections, EARS patterns, REQ-X IDs, AC numbering                     |
| `verify_design_file`       | Design content       | Sections, Mermaid diagrams, DES-X IDs, traceability, Impact Analysis |
| `verify_tasks_file`        | Tasks content        | Sections, phases, checkboxes, traceability, status markers           |
| `verify_complete_spec`     | Complete workflow    | All 3 files together, cross-file traceability                        |

**Error Format**: All tools use 3-level context with SKILL.md links:

```
[Error Type] → Context → Suggested Fix
   See: packages/standards/src/templates/universal/skills/[relevant-skill]/SKILL.md
   Line: 42
```

---

## Standards

- **EARS**: Easy Approach to Requirements Syntax (WHEN, IF, THEN, SHALL, WHILE,
  WHERE)
- **Mermaid**: Standard visualization for architecture and sequence diagrams
- **Folder Convention**:
  `specs/changes/<slug>/[requirements.md | design.md | tasks.md]`
- **Traceability**: Every design and task must link back to a requirement ID

---

## Publishing

The Spec-Driven Steroids monorepo publishes three packages to npm using [Changesets](https://github.com/changesets/changesets) for version management:

- `spec-driven-steroids` - Main CLI
- `@spec-driven-steroids/mcp` - MCP Server
- `@spec-driven-steroids/standards` - Universal standards and templates

### Release Workflow

1. **Create a changeset** describing your change:

   ```bash
   pnpm changeset
   ```

   Select the packages affected and choose the version bump type (patch/minor/major).

2. **Bump versions & update CHANGELOGs**:

   ```bash
   pnpm changeset:version
   ```

3. **Commit the version changes**:

   ```bash
   git add . && git commit -m "chore: version packages"
   ```

4. **Create and push a release tag**:

   ```bash
   pnpm release:tag
   pnpm release:push-tags
   ```

   This creates an annotated git tag in the format `vX.Y.Z` from `packages/cli/package.json`.
   Create the tag **after** committing release/version files so the tag points to the exact released commit.
   If the tag already exists, `pnpm release:tag` fails safely to prevent accidental tag overwrite.

5. **Publish to npm**:

   ```bash
   pnpm changeset:publish
   ```

### Prerequisites

Before publishing, ensure you have:

1. **npm account**: Create one at [npmjs.com](https://www.npmjs.com)
2. **Authenticated**: Run `npm login` to authenticate

### Version Management

All publishable packages use **fixed versioning** - they share the same version number and are released together. This ensures compatibility across the toolkit.

---

## Future Roadmap

- [ ] **Codex** - Support for OpenAI's Codex integration
- [ ] **Claude Code** - Anthropic's Claude Code integration
- [ ] **KiloCode** - Support for KiloCode AI coding assistant
- [ ] **Custom Templates** - User-defined spec templates

---

## Contributing

Spec-Driven Steroids is open to contributions! Whether you want to:

- Add support for a new platforms
- Improve MCP validation tools
- Enhance documentation
- Submit bug reports or feature requests

Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Project Guidelines

For repository development standards and workflows, see:

- [AGENTS.md](AGENTS.md) - AI agent runtime guidance and core commands
- [CONTRIBUTING.md](CONTRIBUTING.md) - contribution workflow and PR expectations
- [STYLEGUIDE.md](STYLEGUIDE.md) - TypeScript/ESM code conventions and patterns
- [TESTING.md](TESTING.md) - testing strategy, commands, and coverage notes
- [ARCHITECTURE.md](ARCHITECTURE.md) - package roles and system architecture
- [SECURITY.md](SECURITY.md) - security policy and secure development practices

## License

MIT
