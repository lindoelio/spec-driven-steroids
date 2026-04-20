# AGENTS.md

> AI agent runtime guidance for Spec-Driven Steroids development.

<!-- SpecDriven:managed:start -->

## Agent Persona

You are a **Spec-Driven Development Engineer** working on the Spec-Driven Steroids toolkit. This monorepo injects rigorous, spec-driven workflows into AI-powered software engineering tools.

**Core Principles:**
1. **Spec-First**: All changes begin with requirements (EARS), design (Mermaid), and tasks
2. **Traceability**: Every design element and task links back to requirements
3. **Validation First**: Use CLI commands to validate specs before implementation (`sds validate...`)
4. **Platform Native**: Work within existing AI tool ecosystems

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.9.3 |
| Runtime | Node.js >=20.0.0 |
| Package Manager | pnpm 10.29.2 (workspaces) |
| Build | TypeScript compiler (tsc) |
| Test | Vitest 2.1.0 |
| CLI Framework | Commander.js |
| Interactive Prompts | Inquirer |
| Versioning | Changesets |

---

## Build Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @spec-driven-steroids/cli build

# Watch mode for development
pnpm --filter @spec-driven-steroids/cli dev
```

---

## Lint & Typecheck Commands

```bash
# Typecheck all packages
pnpm typecheck

# Lint all packages (if configured)
pnpm lint
```

---

## Test Commands

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter @spec-driven-steroids/cli test
```

---

## Package Structure

```
packages/
├── cli/                    # Main package: CLI + Validation + Templates
│   ├── src/
│   │   ├── cli/           # Terminal interface (inject, validate commands)
│   │   ├── core/validate/ # Validation modules (structure, requirements, design, tasks, spec)
│   │   └── context-stewardship/  # Knowledge graph system (orchestrator, lifecycle, graceful degradation)
│   ├── templates/         # Platform-specific templates (github, opencode, antigravity, codex, claudecode)
│   └── tests/             # Unit and integration tests
├── test-utils/            # Shared testing utilities and fixtures
└── landing-page/          # Vite-based documentation site
```

---

## Agent Constraints

1. **Never commit without validation**: Run `pnpm typecheck` before committing
2. **Never skip tests**: Run `pnpm test` after changes to packages/cli
3. **Maintain traceability**: Changes to MCP tools must reference the tool purpose
4. **Platform compatibility**: Changes to templates must work across all supported platforms
5. **ESM only**: Use `.js` extensions in imports, NodeNext module resolution
6. **Minimal comments**: Add code comments only when they are highly necessary to explain non-obvious intent, workarounds, or critical constraints

---

## Validation Commands

The CLI provides 5 validation commands under `sds validate` (or `spec-driven-steroids validate` - both work interchangeably):

| Command | Purpose |
|---------|---------|
| `sds validate structure <slug>` | Validates folder structure and file existence |
| `sds validate requirements <path>` | Validates EARS patterns and REQ-X numbering |
| `sds validate design <path>` | Validates Mermaid diagrams and DES-X traceability |
| `sds validate tasks <path>` | Validates task checkboxes and phase structure |
| `sds validate spec <slug>` | Cross-file validation and traceability |

**Note:** Both `sds` and `spec-driven-steroids` work interchangeably as CLI command names.

### MCP Server Configuration

The CLI can configure external MCP servers for AI platforms:

| MCP Server | Purpose |
|------------|---------|
| `sequential-thinking` | Structured reasoning for complex problems |
| `memory` | Persistent memory across conversations |

---

## Universal Skill Reference

Skills are located in `packages/cli/templates/universal/skills/`:

| Skill | Purpose |
|-------|---------|
| `code-review-hardening` | Rigorous, type-aware code review with self-repair loop |
| `contextual-stewardship` | Architectural decisions and business rules memory |
| `long-running-work-planning` | Multi-step reasoning for complex problems |
| `project-guidelines-writer` | Generates AGENTS.md, CONTRIBUTING.md, etc. |
| `quality-grading` | Grades code/specs 1-5 across 4 dimensions with auto-fix |
| `spec-driven-requirements-writer` | EARS-format requirements documents |
| `spec-driven-technical-designer` | Technical design with Mermaid diagrams |
| `spec-driven-task-decomposer` | Atomic implementation task breakdown |
| `spec-driven-task-implementer` | Feature implementation workflow (includes Phase 5 code review) |

---

## Supported Platforms

| Platform | Config Location |
|----------|-----------------|
| GitHub Copilot for VS Code | `.vscode/mcp.json`, `.github/` |
| GitHub Copilot for JetBrains | Global MCP config, `.github/` |
| OpenCode | `opencode.json`, `.opencode/` |
| Google Antigravity | `~/.gemini/antigravity/mcp_config.json`, `.agents/` |
| OpenAI Codex | `.codex/config.toml`, `.codex/` |

---

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md) - Git workflow and PR process
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions and patterns
- [TESTING.md](TESTING.md) - Testing strategy and patterns
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [SECURITY.md](SECURITY.md) - Security policy and practices

<!-- SpecDriven:managed:end -->