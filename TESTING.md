<!-- SpecDriven:managed:start -->

# TESTING.md

## Testing Trophy Strategy

This project's testing mix (integration/E2E alongside unit tests, no declared hierarchy) defaults to the **Testing Trophy** approach:

1. **Integration tests are the main confidence layer** — they verify that full CLI workflows behave correctly end-to-end.
2. **E2E tests cover critical user journeys** — platform injection, validation pipelines, and cross-system flows.
3. **Unit tests are secondary and selective** — reserved for isolated, high-risk logic where fast feedback is essential.

## Frameworks and Tooling

- **Test runner**: [Vitest](https://vitest.dev/) 2.x
- **Coverage**: `@vitest/coverage-v8`
- **Assertions**: Vitest's built-in `expect` (global)
- **Mocks**: `vi.spyOn`, `vi.stubGlobal`, `vi.fn`
- **File system mocks**: `@spec-driven-steroids/test-utils` provides `mockFs` (see [Test Utilities](#test-utilities))

## Running Tests

```bash
# Run all tests (requires prior build for integration tests)
pnpm build && pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with Vitest UI
pnpm test:ui

# Run a specific test file
npx vitest run tests/integration/inject-validate.e2e.test.ts
```

**Important**: Integration tests import compiled output from `dist/`, so run `pnpm build` (or `tsc`) before executing tests when source has changed.

## Test Organization

```
packages/cli/tests/
├── integration/           # E2E tests: full CLI workflows
│   ├── inject-validate.e2e.test.ts
│   ├── gemini-cli-inject.e2e.test.ts
│   ├── clean-global.e2e.test.ts
│   └── transformation-pipeline.test.ts
├── unit/                  # Isolated component tests
│   ├── platform-config.test.ts
│   ├── format-transformer.test.ts
│   ├── error-formatter.test.ts
│   ├── gemini-cli-scope.test.ts
│   ├── template-validation-guidance.test.ts
│   ├── universal-agent-prompt.test.ts
│   ├── context-stewardship-acceptance.test.ts
│   └── validate/
└── helpers/               # Shared test helpers
    └── template-test-helpers.ts
```

## Integration Tests (Primary)

Integration tests verify end-to-end CLI behavior by:
- Creating temporary directories with `mockFs.createTempDir()`
- Mocking user input via `vi.spyOn(inquirer, 'prompt')`
- Running CLI commands programmatically via `program.parseAsync()`
- Asserting filesystem side effects (directory structure, file content)
- Cleaning up with `mockFs.cleanup()` in `afterEach`

These tests are the primary confidence layer. Every CLI command and platform injection should have corresponding integration coverage.

## Unit Tests (Selective)

Unit tests validate isolated, high-risk logic:
- Platform configuration resolution
- Format transformation rules
- Validation module logic
- Pure utility functions

Unit tests import directly from `src/` and run without a build step.

## Coverage Targets

| Package | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `packages/cli` | 75% | 75% | 75% | 75% |
| `packages/test-utils` | 60% | 60% | 60% | 60% |

## Test Utilities

Shared testing utilities are in `@spec-driven-steroids/test-utils`:

```ts
import { mockFs } from '@spec-driven-steroids/test-utils';
```

- `mockFs.createTempDir()` — Creates a temporary filesystem directory
- `mockFs.cleanup()` — Cleans up all temporary directories
- `getFixtureContent(name)` — Loads fixture files for validation testing
- `getFixtureFiles()` — Lists available fixture names

## Writing New Tests

1. For new CLI commands or platform integrations: add an **integration test** in `tests/integration/`.
2. For new validation logic or utility functions: add a **selective unit test** in `tests/unit/` only if the logic is complex or error-prone.
3. Use `descriptive test names` that state expected behavior (`it('inject command with GitHub platform creates .github directory structure'`).
4. Always clean up temporary directories in `afterEach` hooks.
5. When asserting template content, use `process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true'` to avoid remote template fetching during tests.

<!-- SpecDriven:managed:end -->
