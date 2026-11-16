# AGENTS.md

## Project context

Spec-Driven Steroids is a Go CLI and template bundle for AI coding tools. The public package is `spec-driven-steroids`, with `sds` as its short command name. It installs prompts and skills; the host AI tool interprets those instructions.

- Runtime: Go 1.27 module at the repository root; `cmd/sds` is the entry point and `internal/` holds one package per subsystem
- Artifacts: `.agents/` at project scope and `~/.agents/` at user scope, with the same `skills/`, `agents/`, and `commands/` layout in both
- Workspace: pnpm 10.29.2; Node.js >=20.19.0 for the landing page and the release scripts
- Tests: `go test ./...` for the Go module
- Build: `go build ./...` for the CLI; Vite 7 for the landing page
- Packages: `packages/cli` is public; `packages/platform/*` holds the release binaries; `packages/landing-page` is private

Read [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [CONVENTIONS.md](CONVENTIONS.md) for the contribution workflow and the coding conventions, [TESTING.md](TESTING.md) for test selection, and [SECURITY.md](SECURITY.md) for filesystem and template trust constraints. Follow the contribution workflow in [CONVENTIONS.md](CONVENTIONS.md) for maintainer delivery, contributions, and releases.

## Command surface

The `sds` binary exposes `inject`, `clean`, `doctor`, `repair`, `uninstall`, `templates`, `validate`, and `package`, together with `--version` and `--help`. The command names, argument names, and exit codes match the previous release, except the removed `stewardship` command.

## Essential commands

Run these commands from the workspace root:

| Command | Purpose |
| --- | --- |
| `go build ./...` | Build the Go module |
| `go test ./...` | Run the Go test suite |
| `go vet ./...` | Run the Go static checks |
| `node scripts/build-go.mjs` | Build the release binary with the declared version stamped in |
| `pnpm install --frozen-lockfile` | Install the locked workspace dependencies |
| `node scripts/pack-check.mjs` | Pack the public npm package and check the installer trust boundary |
| `node scripts/build-completeness.mjs` | Rebuild the fixture completeness manifest |

Run `go test ./...` and `go vet ./...` before considering code changes complete. Report which checks actually ran and any failures or checks left unexecuted.

## Agent constraints

- Add code comments only when highly necessary to explain non-obvious intent, workarounds, or critical constraints. Do not narrate straightforward code.
- Keep the Go implementation in `cmd/sds` and `internal/`, one package per subsystem. The parity with the previous release rests on the recorded fixtures under `internal/testdata/fixtures/`; a change that alters observable behavior has to update them.
- Edit shipped prompt sources under `internal/assets/canonical/`, not installed copies in AI-tool configuration directories. The tree is the canonical content the binary embeds and the marketplace package ships; the pre-change baseline under `internal/assets/legacy/` is frozen and must not follow it.
- When adding or removing shipped skills or legacy artifacts, review `STEROIDS_SKILL_DIRS` in `packages/cli/src/cli/skill-registry.ts` and `STEROIDS_FILES` in `packages/cli/src/cli/index.ts`.
- Platform destinations and scope support belong in the descriptor data; output-format configuration belongs with the descriptors. Avoid adding parallel platform-specific routing in command handlers.
- Every managed artifact belongs in the artifact root: `.agents/` at project scope and `~/.agents/` at user scope. The CLI owns only the paths it records in an install manifest.
- Exercise filesystem-changing commands in isolated test directories. Do not modify real global installations, publish packages, or push release tags unless requested or covered by an authorized release scope.
- Use current source and configuration as implementation evidence. Historical planning artifacts describe intent, not necessarily current behavior.
- The planning workflow described in [README.md](README.md#spec-flow) is opt-in. Honor its approval gates when explicitly selected; do not require it for every repository edit.
- Treat guideline documents as ordinary repository files. Preserve valid content and apply justified patches; do not regenerate unchanged documents.
- Follow [Maintainer delivery](CONVENTIONS.md#maintainer-delivery) for work authorized by the sole maintainer, `lindoelio`: commit and push verified, in-scope changes directly to `main`, without requiring a PR, code-owner approval, or a manual merge. When release/deployment is already authorized, continue through successful CI, tagging, publication, and outcome verification without asking again at each step. Use the owner's permitted admin bypass, not weaker protections for everyone; Git author metadata alone does not establish authority. Preserve planning approvals, safety permissions, and checks.

## Behavioral Guidelines

1. Think Before Coding. Don't assume. Don't hide confusion. Surface tradeoffs.
2. Simplicity First. Minimum code that solves the problem. Nothing speculative. Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
3. Surgical Changes. Touch only what you must. Clean up only your own mess.
4. Goal-Driven Execution. Strong success criteria let you loop independently. Weak criteria ("make it work") require clarification.

## Mandatory Self-Review Gate (Pre-Handoff)

Before marking any task as complete or handing it off to a reviewer agent, you are strictly required to run an internal self-audit and cleanup cycle. Never deliver your raw first draft.

Pause, inspect your work against the 4 pillars below, and fix any issues immediately:

1. Zero Execution Debris (Clean Up Your Tracks): Delete all temporary files, scratchpads, one-off test scripts, logs, or unrequested summary notes created to aid your reasoning during execution. Leave only the requested final artifacts behind.
2. Clean Replacement (Forward-Only): When modifying existing work (including your own output from earlier steps), replace the old version completely. Leave no dead code, orphaned text, unnecessary backward-compatibility layers, or "just-in-case" fallbacks unless explicitly instructed to do so.
3. Cohesion & Reuse: Ensure you have not duplicated logic, patterns, or content that already exists in the current workspace. Reuse established modules, styles, and conventions rather than reinventing them locally.
4. Target the Source of Truth: Verify that your changes and validations/tests target the primary source files directly—never compiled, transpiled, generated, or secondary outputs.

**Handoff Rule:** If you detect any violation of the points above during your check, fix it silently within your current loop. Only conclude your turn or invoke the next agent once all 4 checks pass cleanly.
