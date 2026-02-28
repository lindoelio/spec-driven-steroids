# Contributing to Spec Driven Steroids

<!-- SpecDriven:managed:start -->

Thanks for contributing to `spec-driven-steroids`.

## Git Workflow

1. Branch from `main` using a scoped prefix (`feature/*`, `fix/*`, `docs/*`, `chore/*`).
2. Keep each branch focused on one change objective.
3. Commit with Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
4. If release output changes, add a changeset and include it in the same PR.

## Pull Request Process

- Open PRs with a clear problem statement, approach, and validation notes.
- Link related issue/spec slug when applicable.
- Keep PR scope reviewable; split unrelated changes into separate PRs.
- Call out breaking changes and migration impact explicitly.

## Repository Structure (Contributor View)

- `packages/cli`: published package containing CLI, MCP server, and templates.
- `packages/test-utils`: reusable fixtures and filesystem mocks.
- `packages/landing-page`: simple Vite-based project surface used in this monorepo.
- `specs/changes/<slug>/`: canonical location for requirements, design, and task artifacts.

## Documentation Responsibilities

- Keep `README.md` user-facing (installation, usage, examples).
- Keep `AGENTS.md` for runtime agent instructions and command entrypoints.
- Keep `STYLEGUIDE.md` for coding conventions.
- Keep `TESTING.md` for test strategy and test-writing practices.
- Keep `ARCHITECTURE.md` for system boundaries and diagrams.
- Keep `SECURITY.md` for vulnerability policy and secure development practices.

## Review Checklist

- Scope is limited to the stated objective.
- Docs/templates are updated when behavior changes.
- Release notes impact is covered via changeset when needed.
- Validation evidence is included in PR description.

<!-- SpecDriven:managed:end -->
