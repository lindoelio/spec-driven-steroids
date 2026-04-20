# AGENTS.md

> AI agent guidance, constraints, and high-level repository context for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Technology Stack

| Aspect | Tool/Version |
|--------|--------------|
| Runtime | Node.js >=20 |
| Package Manager | pnpm 10.29 |
| Language | TypeScript 5.9 (ESM) |
| Testing | Vitest 2.1.0 |
| CLI Framework | Commander 11.1 |
| Release | Changesets |

## Build Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint
```

## Agent Constraints

### Code Comments Policy

Add code comments only when they are highly necessary to explain:
- Non-obvious intent
- Workarounds for platform or library limitations
- Critical constraints or edge case handling

Avoid verbose comments for self-documenting code.

### Working Directory

All file operations are relative to the repository root. Use explicit paths when working with package-specific code.

### Project Structure

```
packages/
├── cli/                    # Main CLI and injection logic
│   └── src/
│       ├── cli/           # Injection commands (index.ts, transformation-pipeline.ts)
│       ├── core/validate/ # Validation modules (requirements, design, tasks, structure)
│       └── context-stewardship/ # Knowledge graph system
├── test-utils/            # Shared test fixtures and MockFileSystem
└── landing-page/         # Documentation site
```

## Supported Platforms

The CLI injects into: Antigravity, Claude Code, Gemini CLI, GitHub Copilot CLI, GitHub Copilot (VS Code, JetBrains), OpenCode, OpenAI Codex, Qwen Code.

## Validation Commands

| Command | Purpose |
|---------|---------|
| `sds validate structure` | Validate spec folder structure |
| `sds validate requirements` | Validate EARS requirements |
| `sds validate design` | Validate design and Mermaid diagrams |
| `sds validate tasks` | Validate tasks and traceability |
| `sds validate spec` | Full end-to-end validation |

See [TESTING.md](TESTING.md) for test commands and patterns.

<!-- SpecDriven:managed:end -->

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md) - PR process and git workflow
- [TESTING.md](TESTING.md) - Testing strategy and patterns
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions
