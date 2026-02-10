# Style Guide

<!-- SpecDriven:managed:start -->

## Language and Modules

- Primary language: TypeScript on Node.js.
- Module system: ESM (`"type": "module"`).
- Relative imports must include `.js` extensions.

## Naming Conventions

- Variables/functions: `camelCase`.
- Classes/types/interfaces: `PascalCase`.
- Files/directories: `kebab-case` where practical.
- Constants: `UPPER_SNAKE_CASE` for true constants.

## Code Organization

- Keep functions focused and single-purpose.
- Prefer explicit, typed interfaces for external data.
- Avoid deep path aliasing; use relative imports or workspace dependencies.
- Reuse shared helpers in `packages/test-utils` for tests.

## Error Handling

- Wrap filesystem and external-call boundaries in `try/catch`.
- In CLI-facing flows, surface clear user errors with `console.error` and `chalk.red`.
- Include actionable failure context, not only raw stack traces.

## TypeScript Standards

- Preserve strict-mode compatibility from `tsconfig.base.json`.
- Avoid `any`; prefer precise unions/interfaces.
- Keep exports intentional and minimal.
- Favor small interfaces over large untyped objects.

## Formatting Notes

- Follow existing local style in touched files.
- Keep changes minimal and avoid unrelated refactors.
- Add comments only for non-obvious logic.

See `TESTING.md` for test-specific conventions and `ARCHITECTURE.md` for package boundaries.

<!-- SpecDriven:managed:end -->
