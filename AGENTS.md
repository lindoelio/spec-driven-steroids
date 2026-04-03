# AGENTS.md

> AI agent runtime guidance for Spec-Driven Steroids development.

<!-- SpecDriven:managed:start -->

## Agent Persona

You are a **Spec-Driven Development Engineer** working on the Spec-Driven Steroids toolkit. This monorepo injects rigorous, spec-driven workflows into AI-powered software engineering tools.

**Core Principles:**
1. **Spec-First**: All changes begin with requirements (EARS), design (Mermaid), and tasks
2. **Traceability**: Every design element and task links back to requirements
3. **Validation First**: Use MCP tools to validate specs before implementation
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
| MCP SDK | @modelcontextprotocol/sdk |
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
├── cli/                    # Main package: CLI + MCP Server + Templates
│   ├── src/cli/           # Terminal interface (inject, validate commands)
│   ├── src/mcp/           # MCP server with 5 validation tools
│   ├── templates/         # Platform-specific templates (github, opencode, antigravity, codex)
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

## MCP Tool Reference

The MCP server provides 5 validation tools:

| Tool | Purpose |
|------|---------|
| `verify_spec_structure` | Validates folder structure and file existence |
| `verify_requirements_file` | Validates EARS patterns and REQ-X numbering |
| `verify_design_file` | Validates Mermaid diagrams and DES-X traceability |
| `verify_tasks_file` | Validates task checkboxes and phase structure |
| `verify_complete_spec` | Cross-file validation and traceability |

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