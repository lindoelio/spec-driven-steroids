# Conventions

Contribute focused changes to the CLI, shipped templates, or landing page. Use [AGENTS.md](AGENTS.md#essential-commands) for setup and verification commands, this document for the contribution workflow and the code conventions, and [TESTING.md](TESTING.md) for test selection.

## Contribution workflow

### Repository layout

The Go module at the repository root is the runtime. The TypeScript implementation was removed once the parity fixtures existed and passed; the recorded fixtures under `internal/testdata/fixtures/` now carry that proof.

```text
cmd/sds/               Native CLI entry point
internal/              Go packages, one per subsystem
  assets/canonical/    Embedded canonical artifact tree
  assets/legacy/       Frozen pre-change baseline for legacy installations
  cli/                 Command surface
  descriptor/          Platform descriptors and descriptor data
  emit/                Canonical and platform-side emission
  manifest/            Install manifests and file bookkeeping
  bundle/              Remote template bundle resolution
  cleanup/             Manifest-driven cleanup
  validate/            Spec validators
  stewardship/         Rule storage, retrieval, and lifecycle
  pack/                Portable package and marketplace catalogs
  config/              Artifact root and internal state directories
  cmdr/                Dependency-free command-line framework
  serialize/           Artifact serialization
  fsutil/              Filesystem helpers
  version/             Single version source
packages/
  cli/                 Public npm package
    bin/install.mjs    Installer that verifies the platform digest
  platform/<os>-<cpu>/ Release packages holding one binary and its digest
  landing-page/        Private Vite site
scripts/               Packaging and release helpers
.github/workflows/     Verification, publishing, and site deployment
```

### Make a change

1. Start from up-to-date `main`, the configured Changesets base branch and CI push target. External contributions use a focused branch; maintainer-owned work follows the direct-delivery policy below.
2. Keep the change limited to one behavior or problem. Include a regression test when fixing a bug.
3. For platform or template changes, verify affected destinations, scopes, and emitted content in integration tests. Change universal sources rather than local installed copies.
4. Update documentation when behavior changes. Check both `README.md` and `packages/cli/README.md` for duplicated product instructions.
5. Run the relevant checks before pushing maintainer work or opening a pull request and record their results.

Use descriptive commit messages. Recent history uses prefixes such as `feat:`, `test:`, and `chore(release):`; no commit-message validator is configured in the checked-in workflows.

### Maintainer delivery

This repository has one maintainer, `lindoelio`. For the maintainer's own work, including agents acting on the maintainer's authorized request, direct delivery to `main` is the default. This is standing authorization to commit and push the requested, verified changes without a PR, code-owner approval, or a manual merge. Use a PR only if the maintainer explicitly requests one; third-party contributions retain the PR process below.

- Confirm the authenticated GitHub actor is `lindoelio` with the necessary repository permissions. Commit authorship alone is not authorization; never change author metadata or credentials to qualify unrelated work for this exception.
- Inspect the working tree and remote state, preserve unrelated changes, and update from `origin/main` without rewriting history. If work is already on a branch, inspect its commits and integrate only authorized work through a normal fast-forward or merge; a PR is not required.
- Complete self-review and relevant local checks before pushing. After pushing, observe CI for the exact `main` commit. Fix in-scope failures and continue; never skip failed checks or claim success from a different commit's run.
- When a release or deployment is part of the request or approved plan, complete that scope autonomously: integrate, push, observe CI, tag the verified release commit when applicable, monitor publication/deployment, and verify the published result. Do not ask the maintainer to approve the same release again at PR, merge, tag, or deployment steps.
- Use the owner's permitted admin bypass when branch protection requires PR reviews but exempts admins. A successful push with a bypass warning is expected for this path; report it and continue. Do not disable protections for other contributors. If the server actually rejects the push, report the blocker rather than forcing history or changing protections silently.
- This exception removes redundant delivery approvals, not planning approvals, host safety permissions, or scope boundaries. A code-only request does not authorize an unrequested release. Repository-only documentation changes do not require a package version or release tag.

### Pull requests and CI

For third-party contributions or an explicitly requested PR, open it against `main`. Explain the problem, the behavioral change, affected platforms or scopes, and how the result was verified. Identify intentional compatibility changes and any checks not run locally.

[CI](.github/workflows/ci.yml) runs on pull requests and pushes to `main`. It checks:

- The Go build, `go vet`, and `gofmt`
- The Go test suite
- The release binary, its stamped version, and a smoke run
- The cross-compilation matrix for the six supported os/cpu pairs
- The built binary on macOS and Windows, with an injection and a cleanup
- The npm package shape and the installer trust boundary

Workflow configuration does not establish repository branch-protection settings. Do not assume a required approval count or signed-commit policy from these files.

### Versioning and publishing

The release version is declared once, in the `VERSION` file at the repository root. Everything that ships derives from it: the embedded copy the binary carries, the npm package manifests, the six platform packages, the template bundle, and the marketplace package.

```bash
node scripts/set-version.mjs 0.24.0
```

The script is the single write path for that declaration. It validates the semantic version, writes `VERSION` and its embedded copy, and updates the version of every package manifest. It deliberately leaves the `workspace:` protocol on the main package's optional dependencies, so a fresh clone installs the local platform packages; `node scripts/prepare-publish.mjs` replaces those specifiers with concrete versions at publication time.

Release publication is triggered by a `v*` tag. The workflow verifies that the tag matches the declared version before it publishes anything, so a mismatched tag fails the release instead of publishing an inconsistent set. The platform binaries are published before the npm package that declares them.

Do not publish by hand. Push the intended commit, wait for CI on that exact commit, tag it, and push the tag; the workflows publish to npm, create the GitHub release, update the Homebrew formula, and publish the template bundle. See [ARCHITECTURE.md](ARCHITECTURE.md#distribution-and-release-boundaries) for the distribution boundaries.

Creating a contribution does not require publishing, pushing tags, or deploying the site. Those are maintainer actions; when included in an authorized delivery scope, follow [Maintainer delivery](#maintainer-delivery) without adding intermediate approval stops. Report registry processing delays separately from workflow success, and do not republish an accepted version just because it is not visible yet.

### Maintain documentation

Guidelines are ordinary Markdown and can be edited with any tool. Read existing content first, preserve valid policies and organization, and apply only justified corrections or material additions. Leave files untouched when no update is needed.

Keep agent instructions in [AGENTS.md](AGENTS.md), the contribution workflow and the coding details in this document, testing guidance in [TESTING.md](TESTING.md), system boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), and security practices in [SECURITY.md](SECURITY.md). Prefer links over repeating full sections.

The optional planning workflow and its approval gates are described in [README.md](README.md#spec-flow). It is not a prerequisite for every contribution.

## Code style

Use the checked-in Biome configuration and the Go rules below as the authority for enforced rules. Preserve the surrounding file's formatting rather than applying an unrelated cleanup.

### Go packages

The Go implementation is the runtime. `cmd/sds` holds the entry point and `internal/` holds one package per subsystem.

- A package name is a single lowercase word that matches its directory: `internal/validate` is package `validate`.
- A file name is snake_case and matches the file's subject: `inject.go`, `cleanup.go`.
- Exported identifiers are camelCase, unexported helpers are camelCase, and constants are UPPER_SNAKE_CASE.
- Every package starts with a doc comment on the `package` clause that states what the package owns.
- Every exported identifier carries a doc comment that starts with its own name.
- Wrap an error with context when returning it and keep the cause with `%w`; do not log and swallow an error.
- Keep a subsystem boundary in its own package. Do not add a cross-package dependency to avoid a small refactor.

### Landing page

The landing page has its own [TypeScript configuration](packages/landing-page/tsconfig.json): ESNext modules, bundler resolution, DOM types, and no TypeScript emit. It is the only TypeScript in the repository, and it ships no CLI code.

### Naming and organization

Follow the existing naming patterns:

| Element | Pattern | Example |
| --- | --- | --- |
| Go files | snake_case | `inject.go` |
| Go packages | single lowercase word matching the directory | `internal/validate` |
| Exported identifiers | camelCase | `CanonicalTree` |
| Unexported identifiers | camelCase | `resolveTemplateSource` |
| Constants | UPPER_SNAKE_CASE | `PLATFORM_DEFINITIONS` |

Keep platform definitions in the descriptor data and the format configuration in its own module. See [ARCHITECTURE.md](ARCHITECTURE.md#implementation-boundaries) before moving responsibilities between subsystems.

Validate external values at the boundary before treating them as known choices, such as injection scopes and output formats.

### Formatting and linting

[biome.json](biome.json) enables linting but disables formatting and import organization, and it covers the landing page and the release scripts.

The configured lint rules reject:

- Unused imports or variables, undeclared variables, and unreachable code
- Explicit `any` in production code
- Loose equality, implicit-any declarations, and async Promise executors

Explicit `any` is permitted by the Biome override for test files. This exception does not apply to production code. Templates, build output, and coverage directories are excluded from Biome's file selection.

Do not claim a formatting convention is automatically enforced when the formatter is disabled.

Go files are formatted with `gofmt` and the module is checked with `go vet` and `go test ./...`.

### Errors and comments

Treat JSON, filesystem content, URLs, and command arguments as external input. Decode into typed values and check the error instead of assuming the shape. Follow existing error and validation-result patterns instead of discarding errors.

At CLI boundaries, provide actionable errors and preserve the command's exit-code and machine-readable output contract. Do not add human-readable output to a JSON response path without checking its callers and tests.

Comments explain non-obvious intent or constraints, not statements the code already expresses. Follow the code-comment policy in [AGENTS.md](AGENTS.md#agent-constraints). Test organization and naming are covered in [TESTING.md](TESTING.md).
