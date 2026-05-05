<!-- SpecDriven:managed:start -->

# AGENTS.md

## Project Identity

This is **Spec-Driven Steroids** (`spec-driven-steroids`), a CLI tool and template bundle that injects a strict Spec-Driven Development workflow (requirements → design → tasks → implementation) into AI coding tools. It ships as a single public npm package with a `sds` alias.

## Technology Stack

- **Language**: TypeScript 5.9, ES2022 target, NodeNext modules, strict mode
- **Runtime**: Node.js >=20
- **Package Manager**: pnpm 10 (workspace monorepo)
- **CLI**: Commander.js 11 + Inquirer 9 + Chalk 5
- **Testing**: Vitest 2.x with v8 coverage
- **Build**: `tsc` (no bundler)
- **Publishing**: Changesets → npm (with provenance)

See [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries and [STYLEGUIDE.md](STYLEGUIDE.md) for code conventions.

## Essential Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests (requires prior build)
pnpm typecheck      # Type-check all packages (no emit)
pnpm lint           # Lint all packages
pnpm test:coverage  # Run tests with coverage
pnpm changeset      # Create a changeset entry
```

When writing code here, always run `pnpm typecheck` before considering a change complete.

## Agent Constraints

- **Code comments policy**: Add code comments only when they are highly necessary to explain non-obvious intent, workarounds, or critical constraints. Do not add comments that merely restate what the code does.
- **Import style**: Use ES module imports only. All packages are `"type": "module"`. Use `.js` extensions in relative imports (TypeScript resolves them correctly).
- **Source layout**: The CLI source lives in `packages/cli/src/`. Tests live in `packages/cli/tests/` (not co-located). Shared test utilities are in `packages/test-utils/src/`.
- **Build before test**: Integration tests import from `dist/`, so `pnpm build` (or `tsc`) must run before `pnpm test`.
- **Package scope**: The `packages/cli` package is the only public package. `packages/test-utils` and `packages/landing-page` are private.
- **Platform template changes**: When editing template files under `packages/cli/templates/`, ensure corresponding E2E tests in `packages/cli/tests/integration/` are updated because many tests verify template content assertions.
- **Template source**: When adding or modifying template files, update `STEROIDS_SKILL_DIRS` and `STEROIDS_FILES` in `packages/cli/src/cli/index.ts` if the new files must be tracked for clean and injection.
- **No direct implementation requests**: Agents must never skip the Spec-Driven phases. Implementation must always follow the full flow (`requirements → design → tasks → implementation`). See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR process.

## Behavioral Guidelines

Guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

<!-- SpecDriven:managed:end -->
