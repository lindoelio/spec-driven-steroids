# STYLEGUIDE.md

> Code style and conventions for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Language & Runtime

| Aspect | Standard |
|--------|----------|
| Language | TypeScript 5.9.3 |
| Runtime | Node.js >=20.0.0 |
| Module System | ESM (`"type": "module"`) |
| Module Resolution | NodeNext |

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## File Organization

### Source Files

```
src/
├── index.ts          # Main entry point (exports public API)
├── cli/
│   └── index.ts      # CLI entry point with shebang
└── mcp/
    ├── index.ts      # MCP server entry point
    └── *.ts          # MCP tool implementations
```

### Test Files

```
tests/
├── unit/             # Unit tests (*.test.ts)
└── integration/      # Integration tests (*.e2e.test.ts)
```

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Source | `kebab-case.ts` | `mermaid-validator.ts` |
| Test | `kebab-case.test.ts` | `mermaid-validator.test.ts` |
| E2E Test | `kebab-case.e2e.test.ts` | `inject-validate.e2e.test.ts` |
| Config | `kebab-case.config.ts` | `vitest.config.ts` |

### Variables & Functions

```typescript
const camelCase = true;
const SCREAMING_SNAKE_CASE = 'CONSTANT';

function camelCaseFunction(): void {}
```

### Interfaces & Types

```typescript
interface PascalCase {
  propertyName: string;
}

type PascalCaseAlias = string | number;
```

### Classes

```typescript
class PascalCase {
  private camelCaseProperty: string;
  
  public camelCaseMethod(): void {}
}
```

### Enums

```typescript
enum PascalCaseEnum {
  SCREAMING_SNAKE_CASE = 'value'
}
```

---

## Import Style

### ESM with Extensions

Always include `.js` extension for local imports:

```typescript
import { something } from './module.js';
```

### External Imports

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
```

### Import Order

1. Node.js built-ins
2. External packages
3. Internal modules (relative)

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

import { Command } from 'commander';
import chalk from 'chalk';

import { formatError } from './error-utils.js';
```

---

## Export Style

### Named Exports (Preferred)

```typescript
export function validateSomething(input: string): boolean {
  return input.length > 0;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Default Export (Entry Points Only)

```typescript
export default program;
```

### Re-exports

```typescript
export { something } from './module.js';
export type { SomeType } from './types.js';
```

---

## Function Style

### Pure Functions

```typescript
function extractIds(content: string): string[] {
  return content.match(/REQ-\d+/g) || [];
}
```

### Error Handling

```typescript
async function readFile(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${path}`);
  }
}
```

### Async Functions

```typescript
async function validateSpec(slug: string): Promise<ValidationResult> {
  const content = await fs.readFile(`specs/changes/${slug}/requirements.md`, 'utf-8');
  return verifyRequirementsFile(content);
}
```

---

## Documentation

### JSDoc for Public APIs

```typescript
/**
 * Validates a Mermaid diagram for syntax errors.
 * 
 * @param content - The Mermaid diagram content
 * @param blockStartLine - The starting line number for error reporting
 * @returns Validation result with errors and warnings
 * 
 * @example
 * ```typescript
 * const result = validateMermaidDiagram('flowchart TD\n  A --> B', 1);
 * ```
 */
export function validateMermaidDiagram(
  content: string,
  blockStartLine: number = 1
): MermaidValidationResult {
  // ...
}
```

### Inline Comments

Use sparingly, prefer self-documenting code:

```typescript
// Extract requirement IDs from headings and explicit references
const fromHeadings = Array.from(content.matchAll(/^###\s+Requirement\s+(\d+)\s*:/gmi), (match) => match[1]);
```

---

## Error Formatting

Follow the 3-level context pattern:

```typescript
interface FormattedError {
  errorType: string;    // Category: "Structure Error", "Format Error", "Traceability Error"
  context: string;      // Specific issue location
  suggestedFix: string; // Actionable guidance
}

function formatError(error: FormattedError): string {
  return `[${error.errorType}] → ${error.context} → ${error.suggestedFix}`;
}
```

---

## Type Patterns

### Union Types for Status

```typescript
type TaskStatus = 'pending' | 'in-progress' | 'completed';
```

### Discriminated Unions

```typescript
type McpServer = 
  | { type: 'local'; command: string[]; enabled?: boolean }
  | { type: 'remote'; url: string; enabled?: boolean; headers?: Record<string, string> };
```

### Const Assertions

```typescript
const SUPPORTED_DIAGRAM_TYPES = [
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'erdiagram'
] as const;

type SupportedDiagramType = typeof SUPPORTED_DIAGRAM_TYPES[number];
```

---

## See Also

- [AGENTS.md](AGENTS.md) - Build and test commands
- [TESTING.md](TESTING.md) - Testing patterns
- [ARCHITECTURE.md](ARCHITECTURE.md) - Package structure
- [CONTRIBUTING.md](CONTRIBUTING.md) - Git workflow

<!-- SpecDriven:managed:end -->