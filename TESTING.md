# Testing

Tests verify CLI behavior, filesystem effects, template transformation, and validation logic. Use integration tests as the main confidence layer, selective unit tests for isolated logic, and smoke tests for the distributed artifact: a Testing Trophy approach for this repository's mixed suite.

## Tooling and prerequisites

The CLI suite runs with Vitest 3 and V8 coverage from the workspace root dependencies. Tests use the Node environment and a configured 30-second timeout.

Set up and build the workspace as described in [AGENTS.md](AGENTS.md#essential-commands) before testing a clean checkout. `@spec-driven-steroids/test-utils` exports compiled files from `dist/`. The CLI's `test` and `test:coverage` scripts run `tsc` before Vitest, but that does not replace building the shared workspace dependency.

Tests in the integration suite import the CLI from `src/`, except for `tests/integration/dist-smoke.test.ts`, which imports `dist/cli/index.js`. Do not generalize the smoke test's compiled-import requirement to every integration test.

## Run the relevant suite

Run these commands from the workspace root:

| Command | Scope |
| --- | --- |
| `pnpm test` | Package test scripts; the CLI defines the current test suite |
| `pnpm test:coverage` | CLI suite with coverage enforcement |
| `pnpm --filter spec-driven-steroids test:ui` | CLI Vitest UI after compiling the CLI |

To run one test file after building the workspace:

```bash
pnpm --filter spec-driven-steroids exec vitest run tests/unit/template-source.test.ts
```

To check prompt contracts and injection together:

```bash
pnpm --filter spec-driven-steroids exec vitest run tests/unit/template-validation-guidance.test.ts tests/integration/inject-validate.e2e.test.ts
```

Direct `vitest` invocation does not perform the compilation included in package test scripts. Rebuild first when a test depends on changed compiled output.

## Test locations and responsibilities

| Location | Responsibility |
| --- | --- |
| `packages/cli/tests/unit/` | Parsers, validators, template-source checks, formatting helpers, scope resolution, and rule-storage logic |
| `packages/cli/tests/integration/` | CLI injection, installation lifecycle, non-interactive behavior, platform outputs, and compiled entry-point smoke tests |
| `packages/cli/tests/helpers/` | Shared template assertions and other suite helpers |
| `packages/test-utils/src/` | Filesystem helpers and reusable fixtures |

Use `*.test.ts` filenames; CLI workflow tests also use `*.e2e.test.ts`. Import the Vitest APIs used by a test explicitly, following neighboring tests. Describe observable behavior in test names.

For filesystem or platform changes, cover the resulting paths and file contents, not just a successful exit. For cleanup changes, include unrelated user files and modified installed files so preservation is exercised. For validator fixes, include a failing input and a valid counterpart.

## Isolate side effects

The `mockFs` helper creates real temporary directories; it is not an in-memory filesystem. Clean up every test-owned directory and restore process-wide state:

- Save and restore the working directory when using `process.chdir`
- Redirect home directories, `SDS_CONFIG_DIR`, caches, and rule-storage roots when the tested path uses them; do not rely on the developer's configuration
- Restore environment variables, mocks, globals, and `process.exitCode` when changed
- Use bundled templates for injection tests through `SPEC_DRIVEN_USE_BUNDLED_TEMPLATES=true` or an explicit bundled source
- Test remote-source behavior with controlled fetch responses and isolated cache directories

See `inject-validate.e2e.test.ts`, `manifest-clean.e2e.test.ts`, and `template-source.test.ts` for existing patterns.

## Coverage and release confidence

The root and CLI Vitest configurations currently enforce these thresholds:

| Statements | Branches | Functions | Lines |
| --- | --- | --- | --- |
| 70% | 65% | 75% | 70% |

Keep the two configurations consistent when intentionally changing coverage policy. Do not lower thresholds merely to hide missing coverage.

CI runs the suite on Linux with Node.js 20, 22, and 24. Platform-path tests simulate other environments; passing them is not evidence of execution on native Windows or macOS runners.

The package smoke check installs an npm tarball in a temporary prefix and invokes the installed CLI. It checks packaging and startup, not the behavior of every command. Its prerequisite and command are listed in [AGENTS.md](AGENTS.md#essential-commands).

Template contract tests check emitted instructions and file placement. They do not execute a host LLM or prove that it follows approval, incremental-edit, or no-op instructions. Behavioral evaluation of generated documents requires a separate run in the host AI tool.
