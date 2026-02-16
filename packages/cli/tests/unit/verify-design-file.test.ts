import { describe, it, expect } from 'vitest';
import { verifyDesignFile } from '-dist/index.js';

describe('MCP Unit: verifyDesignFile', () => {
    const validContent = `# Design Document

## Overview

This is the overview.

### Design Goals

1. Goal one
2. Goal two

### References

- **REQ-1**: Test

---

## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1.1, REQ-1.2_

---

## Code Anatomy

| File Path | Purpose | Implements |
|-----------|---------|------------|
| src/file.ts | Test | DES-1 |

---

## Traceability Matrix

| Design Element | Requirements |
|----------------|--------------|
| DES-1 | REQ-1.1, REQ-1.2 |
`;

    describe('required sections', () => {
        it('validates content with all required sections', () => {
            const result = verifyDesignFile(validContent);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('detects missing Overview section', () => {
            const content = validContent.replace('## Overview', '## Wrong');
            const result = verifyDesignFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Overview'))).toBe(true);
        });

        it('detects missing System Architecture section', () => {
            const content = validContent.replace('## System Architecture', '## Wrong');
            const result = verifyDesignFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('System Architecture'))).toBe(true);
        });

        it('detects missing Code Anatomy section', () => {
            const content = validContent.replace('## Code Anatomy', '## Wrong');
            const result = verifyDesignFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Code Anatomy'))).toBe(true);
        });
    });

    describe('Mermaid diagrams', () => {
        it('detects Mermaid diagram code blocks', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1_
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(true);
        });

        it('detects no Mermaid diagram code blocks', () => {
            const content = `## System Architecture

### DES-1: Component

This is a component.

_Implements: REQ-1_
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No Mermaid diagram code blocks found'))).toBe(true);
        });

        it('handles multiple Mermaid diagrams', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

### DES-2: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(true);
        });
    });

    describe('design element IDs', () => {
        it('detects DES-X IDs', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

### DES-2: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(true);
        });

        it('detects no DES-X IDs', () => {
            const content = `## System Architecture

### Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No DES-X design element IDs found'))).toBe(true);
        });
    });

    describe('traceability', () => {
        const requirementsContent = `## Requirements

### Requirement 1: Test

#### Acceptance Criteria

1. THE system SHALL test. _(Ubiquitous)_

### Requirement 2: Test2

#### Acceptance Criteria

1. THE system SHALL test. _(Ubiquitous)_
`;

        it('validates correct traceability links', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1.1, REQ-2.1_

### DES-2: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1.1_
`;

            const result = verifyDesignFile(content, requirementsContent);
            expect(result.valid).toBe(true);
            expect(result.traceabilityReport.orphaned).toHaveLength(0);
            expect(result.traceabilityReport.invalidReqRefs).toHaveLength(0);
        });

        it('detects orphaned design elements (no traceability)', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

### DES-2: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1.1_
`;

            const result = verifyDesignFile(content, requirementsContent);
            expect(result.valid).toBe(false);
            expect(result.traceabilityReport.orphaned.length).toBe(1);
            expect(result.traceabilityReport.orphaned[0]).toContain('DES-1');
        });

        it('detects invalid requirement references', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-99.9_
`;

            const result = verifyDesignFile(content, requirementsContent);
            expect(result.valid).toBe(false);
            expect(result.traceabilityReport.invalidReqRefs.length).toBe(1);
            expect(result.traceabilityReport.invalidReqRefs[0]).toContain('REQ-99.9');
        });

        it('handles no requirements content', () => {
            const content = `## System Architecture

### DES-1: Component

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: REQ-1.1_
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(true);
        });
    });

    describe('Traceability Matrix section', () => {
        it('detects missing Traceability Matrix section (warning)', () => {
            const content = validContent.replace('## Traceability Matrix', '## Wrong');
            const result = verifyDesignFile(content);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(e => e.includes('Traceability Matrix'))).toBe(true);
        });

        it('validates with Traceability Matrix section', () => {
            const result = verifyDesignFile(validContent);
            expect(result.warnings.some(e => e.includes('Traceability Matrix'))).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('handles empty content', () => {
            const result = verifyDesignFile('');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('handles content with only whitespace', () => {
            const result = verifyDesignFile('   \n\n   ');
            expect(result.valid).toBe(false);
        });

        it('handles complex markdown formatting', () => {
            const content = `# Design Document

## Overview

**Bold** and *italic* text.

### Design Goals

1. Goal **one**
2. Goal \`two\`

---

## System Architecture

### DES-1: **Component** with \`code\`

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

_Implements: **REQ-1.1**, \`REQ-1.2\`_

---

## Code Anatomy

| File Path | Purpose | Implements |
|-----------|---------|------------|
| src/\`file\`.ts | Test | DES-1 |

---

## Traceability Matrix

| Design Element | Requirements |
|----------------|--------------|
| DES-1 | REQ-1.1, REQ-1.2 |
`;

            const result = verifyDesignFile(content);
            expect(result.valid).toBe(true);
        });
    });
});
