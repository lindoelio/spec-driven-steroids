# Style Guide

<!-- SpecDriven:managed:start -->

## Language and Modules

- Primary language is TypeScript on Node.js.
- Module system is ESM (`"type": "module"`).
- Relative imports must include `.js` extensions.
- Preserve strict TypeScript compatibility from `tsconfig.base.json`.

## Naming Conventions

- Variables/functions: `camelCase`.
- Classes/types/interfaces: `PascalCase`.
- Files/directories: `kebab-case` where practical.
- Constants: `UPPER_SNAKE_CASE` for true constants.

## Code Organization

- Keep functions focused and single-purpose.
- Prefer explicit, typed interfaces for external data.
- Keep module boundaries clear between CLI runtime, MCP validators, and templates.
- Avoid deep path aliasing; use relative imports or workspace dependencies.
- Reuse shared helpers in `packages/test-utils` for tests.

## Error Handling

- Wrap filesystem and external-call boundaries in `try/catch`.
- In CLI-facing flows, surface clear user errors with `console.error` and `chalk.red`.
- Include actionable failure context, not only raw stack traces.

## TypeScript Standards

- Avoid `any`; prefer precise unions/interfaces.
- Keep exports intentional and minimal.
- Favor small interfaces over large untyped objects.
- Prefer pure helper functions for validation logic where practical.

## Formatting Notes

- Follow existing local style in touched files.
- Keep changes minimal and avoid unrelated refactors.
- Add comments only for non-obvious logic.

See `TESTING.md` for test strategy, `ARCHITECTURE.md` for system design, and `SECURITY.md` for secure coding expectations.

<!-- SpecDriven:managed:end -->
