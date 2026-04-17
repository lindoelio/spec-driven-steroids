# TESTING.md

> Testing strategy and patterns for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Testing Strategy

This project follows the **Testing Trophy** approach:

```
        ╱╲
       ╱  ╲  E2E Tests (Critical paths only)
      ╱────╲
     ╱      ╲
    ╱────────╲ Integration Tests (Primary confidence layer)
   ╱          ╲
  ╱────────────╲
 ╱              ╲
╱────────────────╲ Unit Tests (Selective, high-risk logic)
╱                  ╲
```

### Priority Order

1. **Integration Tests** - Primary confidence layer
   - MCP tool validation against real file structures
   - CLI command execution with actual file system
   - Cross-package interactions

2. **E2E Tests** - Critical user journeys
   - Full spec workflow validation
   - Platform injection complete flow

3. **Unit Tests** - Selective and targeted
   - Pure functions with complex logic
   - Input validation and error formatting
   - Parser implementations (Mermaid, EARS)

---

## Test Framework

| Aspect | Tool |
|--------|------|
| Framework | Vitest 2.1.0 |
| Coverage | @vitest/coverage-v8 |
| Environment | Node.js |
| UI | @vitest/ui |

---

## Commands

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm vitest run tests/unit/mermaid-validator.test.ts

# Run tests in watch mode
pnpm vitest watch
```

---

## Directory Structure

```
packages/cli/tests/
├── unit/                    # Unit tests (*.test.ts)
│   ├── mermaid-validator.test.ts
│   ├── verify-requirements-file.test.ts
│   ├── verify-design-file.test.ts
│   ├── verify-tasks-file.test.ts
│   └── error-formatter.test.ts
└── integration/             # Integration tests (*.e2e.test.ts)
    ├── inject-validate.e2e.test.ts
    └── verify-complete-spec.e2e.test.ts
```

---

## Test Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../src/module.js';

describe('Unit: functionToTest', () => {
    describe('valid inputs', () => {
        it('returns expected result for valid input', () => {
            const result = functionToTest('valid input');
            expect(result).toBe('expected output');
        });
    });

    describe('edge cases', () => {
        it('handles empty input', () => {
            const result = functionToTest('');
            expect(result).toBe('default');
        });
    });
});
```

### Integration Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockFileSystem } from '@spec-driven-steroids/test-utils';

describe('Integration: verifySpecStructure', () => {
    let mockFs: MockFileSystem;

    beforeEach(() => {
        mockFs = new MockFileSystem('/test-dir');
    });

    afterEach(() => {
        mockFs.cleanup();
    });

    it('validates complete spec structure', async () => {
        await mockFs.createStructure({
            '.specs/changes/test-spec/requirements.md': '...',
            '.specs/changes/test-spec/design.md': '...',
            '.specs/changes/test-spec/tasks.md': '...'
        });

        const result = await verifySpecStructure('test-spec', mockFs.root);
        expect(result.valid).toBe(true);
    });
});
```

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | 80% |
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |

### Coverage Exclusions

- `node_modules/`
- `**/*.test.ts`, `**/*.spec.ts`
- `**/dist/**`
- `**/fixtures/**`
- `**/types/**`
- `**/*.config.ts`
- `packages/test-utils/**`

---

## Test Utilities

### MockFileSystem

Located in `packages/test-utils/src/mocks/mock-fs.ts`:

```typescript
import { MockFileSystem } from '@spec-driven-steroids/test-utils';

const mockFs = new MockFileSystem('/test-dir');
await mockFs.createStructure({
    '.specs/changes/test/requirements.md': '# Requirements',
    '.specs/changes/test/design.md': '# Design',
    '.specs/changes/test/tasks.md': '# Tasks'
});
```

### Fixtures

Located in `packages/test-utils/src/fixtures/`:

```typescript
import { getFixtureContent, FIXTURES } from '@spec-driven-steroids/test-utils';

const validSpec = getFixtureContent(FIXTURES.VALID_COMPLETE_SPEC, 'requirements.md');
```

### Available Fixtures

| Fixture | Description |
|---------|-------------|
| `VALID_COMPLETE_SPEC` | Valid spec with all 3 files |
| `INVALID_TRACEABILITY` | Spec with missing traceability |
| `INVALID_EARS_SYNTAX` | Spec with EARS syntax errors |
| `INVALID_MISSING_FILES` | Spec with missing required files |

---

## Validation Module Testing

### Testing Validation Modules

```typescript
import { verifyRequirementsFile } from '../src/core/validate/requirements.js';

describe('Unit: verifyRequirementsFile', () => {
    it('detects EARS patterns', () => {
        const content = `
## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_
2. WHEN triggered, THE system SHALL respond. _(Event-driven)_
`;
        const result = verifyRequirementsFile(content);
        expect(result.earsPatterns).toContain('SHALL');
        expect(result.earsPatterns).toContain('WHEN');
    });
});
```

### Import Pattern for Validation Tests

Tests import directly from source to validate the validation logic:

```typescript
// Import from source for unit testing
import { verifyRequirementsFile } from '../src/core/validate/requirements.js';
import { verifyDesignFile } from '../src/core/validate/design.js';
import { validateMermaidDiagram } from '../src/core/validate/shared/mermaid.js';
```

---

## Test Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Unit | `*.test.ts` | `mermaid-validator.test.ts` |
| Integration | `*.e2e.test.ts` | `inject-validate.e2e.test.ts` |

---

## See Also

- [AGENTS.md](AGENTS.md) - Test commands
- [STYLEGUIDE.md](STYLEGUIDE.md) - Code conventions
- [ARCHITECTURE.md](ARCHITECTURE.md) - Package structure
- [CONTRIBUTING.md](CONTRIBUTING.md) - PR requirements

<!-- SpecDriven:managed:end -->