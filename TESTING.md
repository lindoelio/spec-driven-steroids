# Testing

Tests verify CLI behavior, filesystem effects, template transformation, and validation logic. Use integration tests as the main confidence layer, selective unit tests for isolated logic, and smoke tests for the distributed artifact: a Testing Trophy approach for this repository's mixed suite.

## Tooling and prerequisites

The Go module is the runtime and its suite runs with `go test ./...`. The repository holds no JavaScript test runner for the CLI; the TypeScript implementation was removed once the Go suite reproduced the recorded behavior.

Set up the workspace as described in [AGENTS.md](AGENTS.md#essential-commands) before testing a clean checkout. The Go suite needs the module dependencies only (`go mod download`); the workspace install is needed for the landing page and the release scripts.

## Run the relevant suite

Run these commands from the workspace root:

| Command | Scope |
| --- | --- |
| `go test ./...` | Go module suite |
| `go vet ./...` | Go static checks |
| `go test ./internal/validate/...` | Validator parity, including the golden replay |
| `go test ./internal/emit/...` | Emission behavior against the recorded artifacts |
| `node scripts/pack-check.mjs` | npm package shape and installer trust boundary |
| `node scripts/build-completeness.mjs` | Fixture completeness manifest |

To run one package or one test:

```bash
go test ./internal/manifest/...
go test ./internal/validate/... -run Golden
go test ./internal/cli/... -v -run TestInject
```

`go test ./...` runs the recorded-fixture comparisons in-process; they are fast. The live differential against the previous implementation was removed with that implementation.

## Test locations and responsibilities

| Location | Responsibility |
| --- | --- |
| `internal/*/` | Go package tests: parity checks against the recorded fixtures, descriptor and emission behavior, command-surface rendering |
| `internal/testdata/fixtures/` | Recorded behavioral fixtures and the frozen canonical bodies used as the oracle |
| `internal/assets/guidance_test.go` | The shipped guidance contract, including the consolidation of the contribution rules |
| `internal/cli/` | Command-surface rendering, exit codes, and the completeness manifest |

Go tests use the `testing` package, name the file `<subject>_test.go`, and live next to the package they exercise. Describe observable behavior in test names.

For filesystem or platform changes, cover the resulting paths and file contents, not just a successful exit. For cleanup changes, include unrelated user files and modified installed files so preservation is exercised. For validator fixes, include a failing input and a valid counterpart.

## The recorded fixtures are the baseline

The Go implementation replaced a TypeScript CLI. Before the TypeScript tree was removed, the two were compared case by case and the recorded results were frozen under `internal/testdata/fixtures/`:

| Fixture | Content |
| --- | --- |
| `command-surface/` | The rendered help of every command, the version output, and the error output for unknown commands and options |
| `artifacts/` | The emitted paths and byte contents per platform and scope |
| `validator/validate-golden.json` | Every validator case with its workspace inputs, stdout, stderr, and exit code |
| `completeness.json` | The evidence file behind every acceptance criterion |

A change that alters observable behavior has to update the matching fixture in the same commit. A test that regenerates the fixture it compares against proves nothing: the fixtures are inputs, never outputs.

The validator replay is self-contained, so it runs without the previous implementation present. The live differential harnesses skip when the oracle is absent.

## Isolate side effects

Tests create real temporary directories; they are not in-memory filesystems. Clean up every test-owned directory and restore process-wide state:

- Save and restore the working directory when a test changes it
- Redirect the home directory, `SDS_CONFIG_DIR`, and `SDS_TEMPLATE_CACHE_DIR` when the tested path uses them; do not rely on the developer's configuration
- Restore environment variables and process state when a test changes them
- Use the bundled templates for injection tests instead of a remote source
- Test remote-source behavior with an isolated cache directory

## Coverage and release confidence

The suite has no enforced coverage threshold. The completeness manifest plays that role for the acceptance criteria: it records, for every criterion of the change, the file that implements it and the fixture that demonstrates it. Rebuild it with `node scripts/build-completeness.mjs` and keep it at full coverage.

CI runs the Go build, the Go test suite, `go vet`, a cross-compilation check for every supported operating system and architecture pair, and the packaged-artifact smoke check. Platform-path tests simulate other environments; passing them is not evidence of execution on native Windows or macOS runners.

The package smoke check packs the npm tarball, installs it in a temporary prefix, and verifies the installer's trust boundary. It checks packaging and startup, not the behavior of every command.

Template contract tests check emitted instructions and file placement. They do not execute a host LLM or prove that it follows approval, incremental-edit, or no-op instructions. Behavioral evaluation of generated documents requires a separate run in the host AI tool.
