# CONTRIBUTING.md

> Contribution guidelines for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/spec-driven-steroids.git`
3. Install dependencies: `pnpm install`
4. Build the project: `pnpm build`

---

## Git Workflow

### Branch Naming

```
<type>/<short-description>

Examples:
- feature/mcp-tool-validation
- fix/mermaid-parser-edge-case
- docs/api-reference
- refactor/cli-commands
```

### Branch Types

| Type | Purpose |
|------|---------|
| `feature` | New functionality |
| `fix` | Bug fixes |
| `docs` | Documentation changes |
| `refactor` | Code refactoring |
| `test` | Test additions/modifications |
| `chore` | Maintenance tasks |

---

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting) |
| `refactor` | Code change without fix/feature |
| `test` | Adding/modifying tests |
| `chore` | Build, tooling, dependencies |

### Scopes

| Scope | Package/Area |
|-------|--------------|
| `cli` | CLI commands and interface |
| `mcp` | MCP server and tools |
| `templates` | Platform templates |
| `test-utils` | Testing utilities |
| `docs` | Documentation |

### Examples

```
feat(cli): add validate command for spec structure
fix(mcp): handle empty mermaid blocks correctly
docs(templates): update opencode agent instructions
test(cli): add integration tests for inject command
```

---

## Pull Request Process

### Before Submitting

1. **Create a changeset** (for user-facing changes):
   ```bash
   pnpm changeset
   ```
   Select package and version bump type (patch/minor/major).

2. **Run quality checks**:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```

3. **Update documentation** if needed

### PR Title Format

Same as commit convention: `type(scope): description`

### PR Checklist

- [ ] Branch follows naming convention
- [ ] Commits follow conventional commits
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] Changeset added (if user-facing)
- [ ] Documentation updated (if applicable)

---

## Directory Structure

```
spec-driven-steroids/
├── packages/
│   ├── cli/                    # Main CLI package
│   │   ├── src/
│   │   │   ├── cli/           # CLI commands
│   │   │   └── mcp/           # MCP server
│   │   ├── templates/         # Platform templates
│   │   └── tests/             # Test files
│   ├── test-utils/            # Shared test utilities
│   └── landing-page/          # Documentation site
├── .changeset/                # Changeset configs
├── opencode.json              # OpenCode configuration
├── package.json               # Root package (workspace)
├── tsconfig.base.json         # Shared TypeScript config
└── vitest.config.ts           # Root test configuration
```

---

## Documentation Rules

1. **README.md**: Installation, quick start, and feature overview
2. **CHANGELOG.md**: Auto-generated from changesets
3. **Inline docs**: JSDoc for public APIs
4. **Template docs**: Each template includes usage instructions

### When to Update Docs

- New CLI commands → Update README.md and CLI README
- New MCP tools → Update MCP tool reference
- New templates → Add usage examples
- Breaking changes → Add migration guide

---

## Release Process

Maintainers handle releases:

1. `pnpm changeset:version` - Bump versions and update CHANGELOGs
2. Commit version changes
3. `pnpm release:tag` - Create release tag
4. `pnpm release:push-tags` - Push tags to remote
5. `pnpm changeset:publish` - Publish to npm

---

## See Also

- [AGENTS.md](AGENTS.md) - AI agent runtime guidance
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions
- [TESTING.md](TESTING.md) - Testing strategy
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [SECURITY.md](SECURITY.md) - Security policy

<!-- SpecDriven:managed:end -->