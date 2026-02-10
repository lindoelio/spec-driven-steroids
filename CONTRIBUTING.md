# Contributing to Spec Driven Steroids

<!-- SpecDriven:managed:start -->

Thanks for contributing to `spec-driven-steroids`.

## Workflow

1. Create a feature branch from `main` (example: `feature/<short-topic>`).
2. Implement changes in the relevant `packages/*` workspace.
3. Validate locally from repo root:
   - `pnpm build`
   - `pnpm lint`
   - `pnpm test`
4. Commit using conventional commit style.
5. Open a PR with a clear problem statement, approach, and validation notes.

## Pull Request Expectations

- Keep PRs focused and small enough to review quickly.
- Include tests for behavior changes.
- Update docs/templates when behavior or workflows change.
- Call out breaking changes explicitly.

## Commit and Branch Conventions

- Prefer branch names like `feature/*`, `fix/*`, `docs/*`, `chore/*`.
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Reference related issues/spec slugs when relevant.

## Repository Layout

- `packages/cli`: CLI injector and project setup commands.
- `packages/mcp`: MCP server and validation tools.
- `packages/standards`: reusable template content for agents/skills/workflows.
- `packages/test-utils`: shared fixtures and test helpers.

## Documentation Rules

- Keep `README.md` user-focused (install, usage, quick start).
- Keep `AGENTS.md` focused on AI-agent runtime constraints.
- Put code conventions in `STYLEGUIDE.md`.
- Put testing patterns in `TESTING.md`.
- Put architecture decisions in `ARCHITECTURE.md`.
- Put security practices in `SECURITY.md`.

<!-- SpecDriven:managed:end -->
