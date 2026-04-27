<!-- SpecDriven:managed:start -->

# CONTRIBUTING.md

## Git Workflow

- **Branch naming**: Use descriptive branch names prefixed by change type: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.
- **Commits**: Keep commits focused. Reference a spec slug when a change is spec-driven (e.g., `feat: add unified scope prompt (expand-platform-support)`).
- **Base branch**: All PRs target `main`. Rebase onto `main` before opening a PR.
- **Signoff**: Commits must be signed (verified). Use `-S` or configure `commit.gpgsign true`.

## Pull Request Process

1. Open a PR against `main` with a clear description of the change.
2. Ensure CI passes: builds, tests, typecheck, and lint must all succeed.
3. The PR title should follow the conventional commit format (`feat:`, `fix:`, `refactor:`, etc.).
4. Request review from a maintainer.
5. Merge only after approval and all status checks pass.

## Repository Structure

```
spec-driven-steroids/
├── .changeset/          # Changesets for versioning
├── .github/workflows/   # CI/CD pipelines
├── packages/
│   ├── cli/             # Main CLI (public, published to npm)
│   │   ├── src/
│   │   │   ├── cli/          # Injection commands & platform configs
│   │   │   ├── core/validate/ # Validation modules
│   │   │   └── context-stewardship/ # Knowledge graph system
│   │   ├── templates/   # Platform templates and universal skills
│   │   └── tests/       # Integration and unit tests
│   ├── test-utils/      # Shared testing utilities (private)
│   └── landing-page/    # Documentation site (private, Vite)
├── scripts/             # Build and release utilities
└── specs/               # Spec artifacts for this repo's own features
```

## Documentation Workflow

- Generated guideline documents ([AGENTS.md](AGENTS.md), [STYLEGUIDE.md](STYLEGUIDE.md), [TESTING.md](TESTING.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and this file) contain managed sections wrapped in `<!-- SpecDriven:managed -->` markers. Do not edit content between `SpecDriven:managed:start` and `SpecDriven:managed:end` markers manually — regenerate them with `/inject-guidelines` instead.
- Product-level documentation lives in `README.md` and `packages/cli/README.md`.
- Spec-driven change artifacts follow the `.specs/changes/<slug>/` convention (requirements.md, design.md, tasks.md).

### Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management:

```bash
pnpm changeset          # Create a new changeset entry
pnpm changeset:version  # Consume changesets and bump versions
pnpm changeset:publish  # Publish updated packages
```

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

<!-- SpecDriven:managed:end -->
