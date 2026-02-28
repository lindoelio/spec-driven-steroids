# Testing Guide

<!-- SpecDriven:managed:start -->

## Testing Stack

- Test runner: Vitest.
- Language: TypeScript.
- Workspace config: root `vitest.config.ts` plus package-level config in `packages/cli/vitest.config.ts`.

## Commands

Run from repository root unless package-scoped checks are needed.

- `pnpm test` - run all workspace tests once.
- `pnpm test:ui` - launch Vitest UI.
- `pnpm test:coverage` - generate coverage reports.
- `pnpm --filter <package> test` - run tests for one workspace.

## Strategy

This repository uses a Testing Trophy strategy because test evidence is mixed across root and package-level layouts.

- Integration tests are the primary confidence layer for CLI + MCP behavior.
- E2E tests cover critical user journeys (inject/validate flows and template scaffolding).
- Unit tests are secondary and selective, focused on isolated high-risk logic.

## Suite Types

- Integration/E2E suites live under `packages/cli/tests/integration`.
- Unit suites live under `packages/cli/tests/unit`.
- Shared fixtures and test helpers live in `packages/test-utils`.

## Coverage and Scope Notes

- Coverage provider: `v8`.
- Coverage thresholds differ by scope (root targets 80%; `packages/cli` targets 75%).
- Root include patterns and package include patterns are not identical; follow package-local config when adding tests.
- Exclusions include built artifacts (`dist`), fixtures, config files, and utility package internals.

## Authoring Tests

- Use descriptive test names focused on behavior.
- Prioritize behavior that crosses boundaries (filesystem, template copy, MCP tool execution).
- Add E2E coverage for new command flows or cross-file workflows.
- Add unit tests for parser/validator edge cases and failure formatting paths.
- Reuse fixtures/mocks from `packages/test-utils` where possible.

## Before Opening a PR

- Ensure new behavior is validated by tests.
- Ensure touched test suites run in affected packages.
- Include notes in PR description for any intentionally untested paths.

See `STYLEGUIDE.md` for code conventions and `CONTRIBUTING.md` for PR expectations.

<!-- SpecDriven:managed:end -->
