# Spec Driven Steroids 💪

> Inject Spec-Driven intelligence into your favorite AI Agents. Rigorous.
> Simple. Frictionless.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Vision

**Spec Driven Steroids** is a modular toolkit designed to bring discipline to
AI-powered software engineering. It **injects** high-standard workflows (SDD)
directly into the native environments of your favorite AI tools.

- **Platform Native**: No new UI to learn. Work entirely within your existing AI
  chat.
- **Strict Enforcement**: Uses **Model Context Protocol (MCP)** to
  programmatically validate AI-generated specs.
- **Rigorous Flow**: Requirements (EARS) → Technical Design (Mermaid) → Atomic
  Tasks → Implementation.

**Supported Platforms:**

- GitHub Copilot (VS Code)
- Google Antigravity
- OpenCode

We are actively working on expanding support and are open to contributions. If
your favorite AI tool isn't supported yet, we'd love to hear from you!

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
 ├── standards/             # Markdown templates for Skills & Agents (The Brain)
 └── cli/                  # Terminal interface for injections (The Injector)
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

**Select your platforms** (GitHub Copilot, Antigravity, or OpenCode) to scaffold
the necessary `.github/`, `.agent/`, or `.opencode/` configurations.

**Select MCP servers** from the list:

- GitHub MCP
- Linear MCP
- Atlassian MCP
- Supabase MCP
- Firebase MCP
- Notion MCP
- Postman MCP
- Playwright MCP
- Svelte MCP
- Context7 MCP
- TestStrike MCP

### 3. Connect to Enforcer

Configure your AI tool to connect to the MCP server using `pnpm`:

```json
{
  "servers": {
    "spec-driven-steroids": {
      "command": "pnpm",
      "args": ["dlx", "@spec-driven-steroids/mcp"]
    }
  }
}
```

---

## Usage

### 1. Generate Project Guidelines (Recommended First)

Before using the spec-driven flow, we recommend generating project guidelines to
ensure consistency and best practices.

Use the `/inject-guidelines` command to automatically generate comprehensive
project documentation with zero configuration.

**GitHub Copilot:**

> `/inject-guidelines` _(Analyzes repository and generates AGENTS.md,
> CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, SECURITY.md)_

**GitHub Copilot for JetBrains:**

> `/inject-guidelines` _(Same as VS Code — no plugin installation required)_

**Google Antigravity:**

> `/inject-guidelines` _(Same workflow as GitHub Copilot)_

**OpenCode:**

> `@inject-guidelines` _(Same workflow as GitHub Copilot)_

**What it does:**

- Analyzes 10-30 representative files to understand your project
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

Spec Driven Steroids injects a **Primary Agent** and **Skills** for OpenCode.

- **Plan a Feature with Spec-Driven Agent**:
  > Switch to the **spec-driven** agent (press Tab) and describe your feature.
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

## MCP Server Selection

The CLI supports 11 MCP servers:

- **GitHub MCP** - Repository management, file operations, GitHub API
  integration
- **Linear MCP** - Issue tracking, projects, and comments
- **Atlassian MCP** - Jira and Confluence integration
- **Supabase MCP** - Database and auth services
- **Firebase MCP** - Firebase tools integration
- **Notion MCP** - Notion API integration
- **Postman MCP** - API collection and testing
- **Playwright MCP** - Browser automation and testing
- **Svelte MCP** - Svelte development tools
- **Context7 MCP** - Search with Context7 API
- **TestStrike MCP** - Test automation (research needed)

**Note**: MCP servers requiring API keys (GitHub, Linear, Atlassian, Supabase,
Notion, Postman, Context7) will display documentation links during injection.
Configuration of API keys is left to the user.

---

## Impact Analysis

The Technical Designer skill includes a comprehensive **Impact Analysis**
section for changes to existing features:

**What's Analyzed:**

- Affected modules, files, and components
- Data flow and dependencies
- External services or APIs
- Existing test coverage gaps

**Risk Categories:**

- Breaking changes (API, schema changes)
- Performance implications
- Security considerations
- Migration needs

**Mitigation Planning:**

- Backward compatibility requirements
- Rollback strategies
- Testing strategies (unit, integration, regression)
- Gradual rollout for high-risk changes

---

## Publishing

The Spec Driven Steroids monorepo publishes three packages to npm:

### Publish All Packages

From the repository root:

```bash
# Build and publish all packages
pnpm release
```

This will:

1. Build all packages (`pnpm build`)
2. Bump versions using Changeset (optional setup required)
3. Publish all packages to public npm registry

### Publish Individual Packages

**CLI Package:**

```bash
pnpm release:cli
```

**MCP Server Package:**

```bash
pnpm release:mcp
```

**Standards Package:**

```bash
pnpm release:standards
```

### Prerequisites

Before publishing, ensure you have:

1. **npm account**: Create one at [npmjs.com](https://www.npmjs.com)
2. **Authenticated**: Run `npm login` to authenticate
3. **Built packages**: Run `pnpm build` to create distributables

### Package Access

All packages are published as **public** packages:

- `spec-driven-steroids` - Main CLI
- `@spec-driven-steroids/mcp` - MCP Server
- `@spec-driven-steroids/standards` - Universal standards and templates

### Version Management

Each package has independent versions managed in their respective `package.json`
files. For automated version bumping with release notes, consider integrating
[Changeset](https://github.com/changesets/changesets).

---

## Roadmap

- [ ] **JetBrains IDEs** - IntelliJ IDEA, PyCharm, WebStorm, and other JetBrains
      products
- [ ] **Codex** - Support for OpenAI's Codex integration
- [ ] **Claude Code** - Anthropic's Claude Code integration
- [ ] **More MCP Tools** - Additional validation capabilities
- [ ] **Custom Templates** - User-defined spec templates
- [ ] **CI/CD Integration** - Automated spec validation in pipelines

## Contributing

Spec Driven Steroids is open to contributions! Whether you want to:

- Add support for a new platform (JetBrains, Codex, Claude Code, etc.)
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
