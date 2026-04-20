# CONTRIBUTING.md

> Contribution guidelines, git workflow, and PR process for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build the project: `pnpm build`
4. Run tests: `pnpm test`

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<slug>` | `feat/add-qwen-support` |
| Fix | `fix/<slug>` | `fix/validate-ears-error` |
| Hotfix | `hotfix/<slug>` | `hotfix/release-tag-format` |
| Refactor | `refactor/<slug>` | `refactor/injection-pipeline` |

### Commit Messages

Use conventional commits:

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `hotfix`, `refactor`, `docs`, `test`, `chore`

Example:

```
feat(validation): add EARS pattern detection

- Detect SHALL, MUST, SHOULD patterns
- Add error context for missing patterns
```

## PR Process

### Before Submitting

1. Run `pnpm test` - all tests must pass
2. Run `pnpm typecheck` - no type errors
3. Run `pnpm lint` - no lint errors
4. Update [CHANGELOG.md](packages/cli/CHANGELOG.md) if applicable

### PR Description

Include:
- Summary of changes
- Related issue or context
- Testing performed

### Review Process

- At least one approval required
- Address all review comments
- Re-run tests before merge

## Repository Structure

```
.
├── packages/
│   ├── cli/           # Main CLI package
│   │   ├── src/
│   │   │   ├── cli/        # Injection commands
│   │   │   ├── core/        # Validation modules
│   │   │   └── context-stewardship/  # Knowledge graph
│   │   ├── templates/   # Platform templates
│   │   ├── tests/      # CLI tests
│   │   └── package.json
│   ├── test-utils/    # Test utilities
│   └── landing-page/  # Documentation site
├── specs/            # Spec-driven specs
│   └── changes/       # Change specs
├── .specs/            # Repository spec
└── vitest.config.ts    # Root test config
```

## Release Process

Uses Changesets for versioning and publishing:

```bash
pnpm changeset
pnpm changeset:version
pnpm test && pnpm build
git push origin main
pnpm release:tag
pnpm release:push-tags
```

See [AGENTS.md](AGENTS.md) for build commands.

<!-- SpecDriven:managed:end -->

## See Also

- [AGENTS.md](AGENTS.md) - Build commands and project structure
- [TESTING.md](TESTING.md) - Testing patterns and utilities
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions