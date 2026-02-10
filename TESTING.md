# Testing Guide

<!-- SpecDriven:managed:start -->

## Testing Stack

- Test runner: Vitest.
- Language: TypeScript.
- Shared config: `vitest.config.ts` at repository root.

## Commands

Run from repository root unless package-scoped checks are needed.

- `pnpm test` - run all workspace tests once.
- `pnpm test:ui` - launch Vitest UI.
- `pnpm test:coverage` - generate coverage reports.
- `pnpm --filter <package> test` - run tests for one workspace.

## Coverage and Scope

- Coverage provider: `v8`.
- Coverage thresholds target 80% for statements, branches, functions, and lines.
- Typical test discovery pattern: `**/__tests__/**/*.test.ts`.
- Exclusions include built artifacts (`dist`), fixtures, config files, and utility package internals.

## Authoring Tests

- Prefer colocated test suites under `__tests__` directories.
- Use descriptive test names focused on behavior.
- Cover success paths, failure paths, and edge cases for validators and CLI flows.
- Reuse fixtures/mocks from `packages/test-utils` where possible.

## Before Opening a PR

- Run `pnpm build` and `pnpm lint` alongside tests.
- Ensure new behavior is validated by tests.
- Include notes in PR description for any intentionally untested paths.

See `STYLEGUIDE.md` for code conventions and `SECURITY.md` for security-sensitive test cases.

<!-- SpecDriven:managed:end -->
