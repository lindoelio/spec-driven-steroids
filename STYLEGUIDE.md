<!-- SpecDriven:managed:start -->

# STYLEGUIDE.md

## TypeScript Configuration

The project enforces strict TypeScript via `tsconfig.base.json`:

| Option | Value |
|---|---|
| `target` | `ES2022` |
| `module` | `NodeNext` |
| `strict` | `true` |
| `noUnusedLocals` | `true` |
| `noUnusedParameters` | `true` |
| `noImplicitReturns` | `true` |
| `noFallthroughCasesInSwitch` | `true` |
| `esModuleInterop` | `true` |
| `forceConsistentCasingInFileNames` | `true` |

## Module System

All packages are `"type": "module"`. Use ES module `import`/`export` exclusively. Relative imports must include the `.js` extension (TypeScript resolves them correctly at compile time):

```ts
import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import type { RuleNode } from './types.js';
```

## Naming

| Category | Convention | Examples |
|---|---|---|
| Classes | PascalCase | `KnowledgeGraphStore`, `ProjectScopedResolver` |
| Interfaces | PascalCase | `RuleNode`, `PlatformConfig`, `ScoredRule` |
| Enums | PascalCase | `FormatType`, `UnifiedInjectionScope` |
| Types (aliases) | PascalCase | `Domain`, `LifecycleValue`, `ConflictDecision` |
| Functions | camelCase | `getPlatformConfig`, `computeSimilarity` |
| Variables | camelCase | `baseDir`, `targetDir`, `rules` |
| Constants | UPPER_SNAKE_CASE | `CONFLICT_SIMILARITY_THRESHOLD`, `DEFAULT_EXPIRATION_YEARS` |
| Files/Directories | kebab-case | `knowledge-graph-store.ts`, `platform-config.ts` |

## Code Style

- **Indentation**: 4 spaces
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes preferred (`'utf-8'`, not `"utf-8"`)
- **Trailing commas**: Not used in imports or object/type literals
- **Braces**: Opening brace on same line (K&R style)
- **Line length**: Aim for reasonable readability; no hard limit

### Imports

Group imports in this order, separated by blank lines:
1. Node built-ins (`fs`, `path`, `os`, `url`)
2. Third-party packages (`commander`, `chalk`, `inquirer`)
3. Internal project modules (`./types.js`, `./utils.js`)

```ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import type { RuleNode, Domain } from './types.js';
import { CONFLICT_SIMILARITY_THRESHOLD } from './types.js';
import { computeSimilarity } from './utils.js';
```

## TypeScript Patterns

- **Prefer `interface` for object shapes**, `type` for unions, tuples, and simple aliases.
- **Return types** on exported functions: Always annotate the return type on public/exported functions. Internal helpers may omit return types when the inference is obvious.
- **`as const` assertions** for read-only arrays and tuples used as configuration.

```ts
const STEROIDS_SKILL_DIRS = [
  'spec-driven-technical-designer',
  'spec-driven-task-implementer',
  // ...
] as const;
```

- **Async/await**: Use `async`/`await` for all asynchronous operations. Never use raw `.then()` chains.
- **Error handling**: Use `try`/`catch` with typed error messages. Surface actionable errors to the user.
- **String templates**: Prefer template literals over concatenation for dynamic strings.

## JSDoc

Use JSDoc for exported public API functions and classes. Keep it concise:

```ts
/**
 * Get platform configuration by platform ID.
 */
export function getPlatformConfig(platformId: string): PlatformConfig | undefined {
  return PLATFORM_CONFIGS[platformId];
}
```

Do not add JSDoc to private helpers unless the intent is genuinely non-obvious.

## Testing File Style

- Test files use `*.test.ts` naming.
- Tests are organized under `tests/integration/` and `tests/unit/`.
- Use Vitest globals (`describe`, `it`, `expect`) imported explicitly.
- Use descriptive test names that state the expected behavior.
- See [TESTING.md](TESTING.md) for full testing strategy.

<!-- SpecDriven:managed:end -->
