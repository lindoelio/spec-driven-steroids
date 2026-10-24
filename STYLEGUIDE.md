# Code style

Use the checked-in TypeScript and Biome configuration as the authority for enforced rules. Preserve the surrounding file's formatting rather than applying an unrelated cleanup.

## TypeScript and modules

The CLI and test utilities extend [tsconfig.base.json](tsconfig.base.json):

| Setting | Value |
| --- | --- |
| Target | ES2022 |
| Module and resolution | NodeNext |
| Strict checking | Enabled |
| Unused locals and parameters | Rejected |
| Missing returns and switch fallthrough | Checked |
| Declarations and source maps | Emitted during build |

Both packages use ES modules. Include `.js` in relative imports so emitted JavaScript resolves correctly:

```typescript
import path from 'path';

import { getPlatformDefinition } from './platform-registry.js';
import type { InjectionScope } from './platform-registry.js';
```

Use type-only imports for dependencies used only as types. Keep exported interfaces and return types explicit at module boundaries, following the surrounding modules.

The landing page has a separate [TypeScript configuration](packages/landing-page/tsconfig.json): ESNext modules, bundler resolution, DOM types, and no TypeScript emit. Do not apply NodeNext-specific import assumptions to that package.

## Naming and organization

Follow the existing naming patterns:

| Element | Pattern | Example |
| --- | --- | --- |
| Files | kebab-case | `template-source.ts` |
| Classes, interfaces, type aliases | PascalCase | `TemplateSourceError`, `InstallManifest` |
| Functions and variables | camelCase | `resolveTemplateSource`, `manifestPath` |
| Module-level fixed configuration | UPPER_SNAKE_CASE | `PLATFORM_DEFINITIONS` |

Keep platform definitions in the registry and format configuration in its dedicated module. See [ARCHITECTURE.md](ARCHITECTURE.md#implementation-boundaries) before moving responsibilities between subsystems.

Use narrow unions for known choices, such as injection scopes and output formats. Validate external values at the boundary before treating them as those types.

## Formatting and linting

[biome.json](biome.json) enables linting but disables formatting and import organization. The repository contains both two-space and four-space TypeScript indentation; retain the local convention. Existing TypeScript uses semicolons and predominantly single-quoted strings.

The configured lint rules reject:

- Unused imports or variables, undeclared variables, and unreachable code
- Explicit `any` in production code
- Loose equality, implicit-any declarations, and async Promise executors

Explicit `any` is permitted by the Biome override for test files. This exception does not apply to production code. Templates, build output, and coverage directories are excluded from Biome's file selection.

Do not claim a formatting convention is automatically enforced when the formatter is disabled.

## Errors and comments

Treat JSON, filesystem content, URLs, and command arguments as external input. Narrow `unknown` values before accessing fields. Follow existing typed error and validation-result patterns instead of suppressing errors with broad casts.

At CLI boundaries, provide actionable errors and preserve the command's exit-code and machine-readable output contract. Do not add human-readable output to a JSON response path without checking its callers and tests.

Comments explain non-obvious intent or constraints, not statements the code already expresses. Follow the code-comment policy in [AGENTS.md](AGENTS.md#agent-constraints). Test organization and naming are covered in [TESTING.md](TESTING.md).
