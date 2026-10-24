# AGENTS.md

## Project context

Spec-Driven Steroids is a TypeScript CLI and template bundle for AI coding tools. The public package is `spec-driven-steroids`, with `sds` as its short command name. It installs prompts and skills; the host AI tool interprets those instructions.

- Workspace: pnpm 10.29.2; Node.js >=20.19.0 for repository development
- CLI: TypeScript 5.9, ES2022, NodeNext modules, Commander 11, Inquirer 9, Chalk 5
- Tests: Vitest 3 with V8 coverage in the CLI suite
- Build: `tsc` for the CLI and test utilities; Vite 7 for the landing page
- Packages: `packages/cli` is public; `packages/test-utils` and `packages/landing-page` are private

Read [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, [STYLEGUIDE.md](STYLEGUIDE.md) for coding conventions, [TESTING.md](TESTING.md) for test selection, and [SECURITY.md](SECURITY.md) for filesystem and template trust constraints. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for changesets and pull requests.

## Essential commands

Run these commands from the workspace root:

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install the locked workspace dependencies |
| `pnpm typecheck` | Type-check all packages without emitting output |
| `pnpm build` | Build all packages in dependency order |
| `pnpm lint` | Run the configured Biome checks |
| `pnpm test` | Run package test scripts |
| `pnpm test:coverage` | Run tests with coverage thresholds |
| `pnpm pack:check` | Pack, install, and smoke-test the public npm package |

Build before testing a clean checkout: the shared test utilities export compiled files from `dist/`. The CLI test script compiles the CLI itself before running Vitest. Most tests import CLI source; `packages/cli/tests/integration/dist-smoke.test.ts` intentionally imports the compiled entry point.

Run `pnpm typecheck` before considering code changes complete. Report which checks actually ran and any failures or checks left unexecuted.

## Agent constraints

- Add code comments only when highly necessary to explain non-obvious intent, workarounds, or critical constraints. Do not narrate straightforward code.
- Use ES module imports. Relative imports in the CLI and test utilities use `.js` extensions, even in TypeScript files.
- Keep CLI implementation under `packages/cli/src/` and tests under `packages/cli/tests/`. Shared test utilities belong in `packages/test-utils/src/`.
- Edit shipped prompt sources under `packages/cli/templates/`, not installed copies in AI-tool configuration directories. Update the corresponding template and integration tests.
- When adding or removing shipped skills or legacy artifacts, review `STEROIDS_SKILL_DIRS` in `packages/cli/src/cli/skill-registry.ts` and `STEROIDS_FILES` in `packages/cli/src/cli/index.ts`.
- Platform destinations and scope support belong in `platform-registry.ts`; output-format configuration belongs in `platform-config.ts`. Avoid adding parallel platform-specific routing in command handlers.
- Exercise filesystem-changing commands in isolated test directories. Do not modify real global installations, publish packages, or push release tags unless requested.
- Use current source and configuration as implementation evidence. Historical planning artifacts describe intent, not necessarily current behavior.
- The planning workflow described in [README.md](README.md#spec-flow) is opt-in. Honor its approval gates when explicitly selected; do not require it for every repository edit.
- Treat guideline documents as ordinary repository files. Preserve valid content and apply justified patches; do not regenerate unchanged documents.

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
