# STYLEGUIDE.md

> Code conventions and patterns for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## TypeScript Conventions

### ESM Only

This project uses ESM (ECMAScript Modules). All imports must use `.js` extensions:

```typescript
// ✅ CORRECT
import { formatValidationResult } from './shared/formatter.js';
import chalk from 'chalk';

// ❌ WRONG
import { formatValidationResult } from './shared/formatter';
```

### Module Resolution

All packages use `NodeNext` module resolution. Ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### Type Imports

Prefer `import type` for type-only imports to improve build performance:

```typescript
// ✅ CORRECT - type-only import
import type { ValidationResult, ValidationError } from './shared/formatter.js';

// ✅ CORRECT - value import
import { formatValidationResult } from './shared/formatter.js';
```

---

## Naming Conventions

### Files and Directories

| Entity | Convention | Example |
|--------|------------|---------|
| TypeScript files | kebab-case | `mock-fs.ts`, `error-formatter.ts` |
| Test files | kebab-case + `.test.ts` or `.e2e.test.ts` | `error-formatter.test.ts` |
| Directories | kebab-case | `context-stewardship/`, `validate/shared/` |
| Skill directories | kebab-case | `contextual-stewardship/`, `code-review-hardening/` |

### Identifiers

| Entity | Convention | Example |
|--------|------------|---------|
| Functions | camelCase | `formatValidationResult`, `detectEarsPatterns` |
| Classes | PascalCase | `KnowledgeGraphStore`, `ContextStewardshipOrchestrator` |
| Interfaces | PascalCase | `ValidationResult`, `RetrievalQuery` |
| Types | PascalCase | `Domain`, `LifecycleValue`, `CapabilityTier` |
| Constants | UPPER_SNAKE_CASE | `EARS_KEYWORDS`, `DEFAULT_EXPIRATION_YEARS` |
| Enum members | PascalCase | `UnifiedInjectionScope.GLOBAL` |
| Boolean variables | is/has/can prefix | `isValid`, `hasEarsPatterns`, `canInject` |

### TypeScript-Specific

```typescript
// Interface naming
interface ValidationResult { }
interface McpServerEntry { }

// Type naming
type Domain = 'architecture' | 'business' | 'workflow' | string;
type LifecycleValue = 'active' | 'deprecated' | 'archived';

// Generic type parameters
interface RuleNode<T extends string = string> { }
```

---

## Code Style

### No Semicolons

The codebase does not use semicolons. Use ASI (Automatic Semicolon Insertion):

```typescript
// ✅ CORRECT
const result = formatValidationResult(result, 'text')
return result

// ❌ WRONG
const result = formatValidationResult(result, 'text');
return result;
```

### Braces

Use K&R brace style (1TBS):

```typescript
// ✅ CORRECT
if (result.valid) {
    return formatText(result)
}

// ❌ WRONG
if (result.valid)
    return formatText(result)
```

### Indentation

Use 4 spaces for indentation:

```typescript
function verifyRequirementsFile(content: string): RequirementsValidationResult {
    const errors: ValidationError[] = []
    const warnings: Array<{ line?: number; message: string }> = []
    // ...
}
```

### String Quotes

Prefer single quotes for strings:

```typescript
// ✅ CORRECT
const errorType = 'Structure Error'
const message = `Error: ${errorType}`

// ❌ WRONG
const errorType = "Structure Error"
```

### Template Literals

Use template literals for string interpolation:

```typescript
// ✅ CORRECT
const message = `[${errorType}] → ${context || error.message} → ${suggestedFix || ''}`

// ❌ WRONG
const message = '[' + errorType + '] → ' + (context || error.message) + ' → ' + (suggestedFix || '')
```

---

## Function Design

### Single Responsibility

Functions should do one thing well:

```typescript
// ✅ CORRECT - focused function
function detectEarsPatterns(content: string): string[] {
    const found: string[] = []
    for (const keyword of EARS_KEYWORDS) {
        if (content.includes(keyword)) {
            found.push(keyword)
        }
    }
    return found
}

// ❌ WRONG - multiple responsibilities
function verifyRequirementsFile(content: string) {
    // validates, formats, logs, exits...
}
```

### Async/Await

Prefer async/await over raw promises:

```typescript
// ✅ CORRECT
async function readSpecFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
}

// ❌ WRONG
function readSpecFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
}
```

### Error Handling

Use structured errors with context:

```typescript
interface ValidationError {
    line?: number
    errorType: string
    message?: string
    suggestedFix?: string
    context?: string
    skillDocLink?: string
}

function formatError(error: ValidationError): string {
    let message = `[${error.errorType}] → ${error.context || error.message} → ${error.suggestedFix || ''}`
    if (error.skillDocLink) {
        message += `\n   See: ${error.skillDocLink}`
    }
    return message
}
```

---

## Class Design

### Dependency Injection

Inject dependencies through constructor:

```typescript
export class ContextStewardshipOrchestrator {
    private globalStore: KnowledgeGraphStore
    private resolver: ProjectScopedResolver
    private lifecycle: LifecycleManager
    private router: GracefulDegradationRouter

    constructor(router?: GracefulDegradationRouter) {
        this.router = router ?? defaultRouter
        this.globalStore = new KnowledgeGraphStore('global')
        this.resolver = new ProjectScopedResolver(this.globalStore)
        this.lifecycle = new LifecycleManager(this.globalStore)
    }
}
```

### Expose Public Interface

Keep public methods minimal. Use `private` for internal methods:

```typescript
export class KnowledgeGraphStore {
    async saveRule(rule: RuleNode): Promise<void> { }
    async readRule(ruleId: string): Promise<RuleNode | undefined> { }
    async listRules(): Promise<RuleNode[]> { }

    private createRuleId(): string { }
    private detectConflicts(rule: RuleNode): Promise<ConflictResult[]> { }
}
```

---

## File Organization

### Directory Structure Pattern

```
src/
├── cli/                      # CLI entry points and commands
│   ├── index.ts              # Main CLI (program, commands)
│   ├── platform-config.ts    # Platform-specific configs
│   └── template-source.ts    # Template resolution
├── core/
│   └── validate/             # Validation modules
│       ├── index.ts          # Command factory
│       ├── requirements.ts   # Requirements validator
│       ├── design.ts         # Design validator
│       ├── tasks.ts         # Tasks validator
│       ├── structure.ts     # Structure validator
│       ├── spec.ts          # Complete spec validator
│       └── shared/          # Shared utilities
│           ├── formatter.ts # Error formatting
│           ├── ears.ts      # EARS pattern detection
│           ├── mermaid.ts   # Mermaid validation
│           ├── ids.ts       # ID extraction
│           └── traceability.ts
└── context-stewardship/      # Knowledge graph system
    ├── orchestrator.ts       # Main orchestrator
    ├── knowledge-graph-store.ts
    ├── lifecycle-manager.ts
    ├── graceful-degradation-router.ts
    └── types.ts              # Core types
```

### Export Patterns

Use named exports for utilities and barrel files for re-exports:

```typescript
// ✅ CORRECT - named exports
export function verifyRequirementsFile(content: string): RequirementsValidationResult { }
export function createRequirementsCommand(): Command { }

// ✅ CORRECT - re-export from index
export { formatValidationResult, createValidationResult } from './formatter.js'

// ❌ WRONG - default export for utilities
export default function verifyRequirementsFile() { }
```

---

## Validation Module Patterns

### Result Types

All validators return a structured `ValidationResult`:

```typescript
interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
    warnings: ValidationWarning[]
    [key: string]: unknown  // Extended with extra fields (requirementsFound, earsPatterns, etc.)
}
```

### Validator Pattern

```typescript
function verifyXxxFile(content: string): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: Array<{ line?: number; message: string }> = []

    // Validation logic
    if (someCondition) {
        errors.push({
            errorType: 'Format Error',
            context: 'Description of what went wrong',
            suggestedFix: 'How to fix it',
            skillDocLink: 'path/to/skill.md'
        })
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    }
}
```

### Skill Doc Links

Include `skillDocLink` for actionable guidance:

```typescript
const SKILL_DOCS = {
    requirements: 'skills/spec-driven-requirements-writer/SKILL.md',
    design: 'skills/spec-driven-technical-designer/SKILL.md',
    tasks: 'skills/spec-driven-task-decomposer/SKILL.md'
} as const
```

---

## Context Stewardship Patterns

### Domain Types

Use the standard domain vocabulary:

```typescript
export type Domain =
    | 'architecture'
    | 'business'
    | 'workflow'
    | 'security'
    | 'performance'
    | 'legal'
    | 'team-structure'
    | 'technical-debt'
    | string  // custom domains allowed

export const STANDARD_DOMAINS: Domain[] = [
    'architecture', 'business', 'workflow', 'security',
    'performance', 'legal', 'team-structure', 'technical-debt'
]
```

### Lifecycle States

Use the three-state lifecycle:

```typescript
export type LifecycleValue = 'active' | 'deprecated' | 'archived'

interface LifecycleState {
    value: LifecycleValue
    changedAt: string  // ISO-8601
    changedBy: string
}
```

### Knowledge Graph Storage

Use the degradation router to access the knowledge graph:

```typescript
import { GracefulDegradationRouter, defaultRouter } from './graceful-degradation-router.js'

const router = new GracefulDegradationRouter()
await router.initialize()

// Check available features
const caps = router.getCapabilities()
// caps.tier is always 'tier2-json-graph'
// caps.fileSystemAvailable indicates if storage is accessible
// caps.enabledFeatures includes: json-graph, semantic-retrieval, versioning, conflict-detection
```

---

## CLI Patterns

### Commander.js Commands

Use Commander's chainable API:

```typescript
import { Command } from 'commander'

export function createRequirementsCommand(): Command {
    const cmd = new Command()

    cmd
        .name('requirements')
        .description('Validate a requirements.md file')
        .argument('<path>', 'Path to requirements.md file')
        .option('--format <text|json>', 'Output format', 'text')
        .action(async (filePath: string, opts: { format: string }) => {
            // Implementation
        })

    return cmd
}
```

### Chalk for Output

Use chalk for colored terminal output:

```typescript
import chalk from 'chalk'

// Status messages
console.log(chalk.green('✅ Validation passed.'))
console.log(chalk.red('❌ Validation failed:'))

// Info messages
console.log(chalk.cyan('Processing file:', filePath))
console.log(chalk.yellow('Warning: Using fallback'))
```

---

## Comment Policy

Add code comments only when they are highly necessary to explain:

1. **Non-obvious intent** - Why the code does something counterintuitive
2. **Workarounds** - Why a specific approach was taken despite alternatives
3. **Critical constraints** - Important behavior that must not change

```typescript
// ✅ CORRECT - explains workaround
// Workaround: JSON.parse fails on BOM, strip it before parsing
const stripped = content.replace(/^\uFEFF/, '')

// ❌ WRONG - states the obvious
// Increment i by 1
i++

// ❌ WRONG - no comment needed
// Check if valid
if (result.valid) { }
```

---

## Import Ordering

Organize imports in this order:

1. Node.js built-ins (`fs`, `path`, `os`, `url`)
2. External packages (`commander`, `chalk`, `inquirer`)
3. Internal packages (`@spec-driven-steroids/test-utils`)
4. Relative imports (local modules)

Separate groups with blank lines:

```typescript
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

import chalk from 'chalk'
import inquirer from 'inquirer'

import { MockFileSystem } from '@spec-driven-steroids/test-utils'

import { formatValidationResult } from './shared/formatter.js'
import { detectEarsPatterns } from './shared/ears.js'
```

---

## See Also

- [AGENTS.md](AGENTS.md) - Build commands and agent constraints
- [CONTRIBUTING.md](CONTRIBUTING.md) - Git workflow and PR process
- [TESTING.md](TESTING.md) - Testing patterns
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [SECURITY.md](SECURITY.md) - Security practices

<!-- SpecDriven:managed:end -->