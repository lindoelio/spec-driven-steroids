import { describe, it, expect } from 'vitest';
import { verifyRequirementsFile } from '-dist/index.js';

describe('MCP Unit: verifyRequirementsFile', () => {
    const validContent = `# Requirements Document

## Introduction

This is the introduction section.

## Glossary

| Term | Definition |
|------|------------|
| test | Test term |

## Requirements

### Requirement 1: Test

**User Story:** As a user, I want to test, so that it works.

#### Acceptance Criteria

1. THE system SHALL test. _(Ubiquitous)_
2. WHEN triggered, THE system SHALL respond. _(Event-driven)_
`;

    describe('required sections', () => {
        it('validates content with all required sections', () => {
            const result = verifyRequirementsFile(validContent);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('detects missing Introduction section', () => {
            const content = validContent.replace('## Introduction', '## Wrong');
            const result = verifyRequirementsFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Introduction'))).toBe(true);
        });

        it('detects missing Glossary section', () => {
            const content = validContent.replace('## Glossary', '## Wrong');
            const result = verifyRequirementsFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Glossary'))).toBe(true);
        });

        it('detects missing Requirements section', () => {
            const content = validContent.replace('## Requirements', '## Wrong');
            const result = verifyRequirementsFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Requirements'))).toBe(true);
        });
    });

    describe('requirement IDs', () => {
        it('detects REQ-X IDs', () => {
            const content = `## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_

### Requirement 2: Test2

1. THE system SHALL test. _(Ubiquitous)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.requirementsFound).toEqual(['REQ-1', 'REQ-2']);
        });

        it('detects no REQ-X IDs', () => {
            const content = `## Requirements

### Test

1. THE system SHALL test. _(Ubiquitous)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(false);
            expect(result.requirementsFound).toHaveLength(0);
            expect(result.errors.some(e => e.includes('No REQ-X IDs found'))).toBe(true);
        });

        it('handles multiple REQ-X references', () => {
            const content = `## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_

This references REQ-1 and also mentions REQ-1 again.

### Requirement 2: Test2

1. THE system SHALL test. _(Ubiquitous)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.requirementsFound).toContain('REQ-1');
            expect(result.requirementsFound).toContain('REQ-2');
        });
    });

    describe('EARS patterns', () => {
        it('detects EARS keywords', () => {
            const content = `## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_
2. WHEN triggered, THE system SHALL respond. _(Event-driven)_
3. WHILE running, THE system SHALL work. _(State-driven)_
4. WHERE enabled, THE system SHALL do more. _(Optional)_
5. IF error, THEN THE system SHALL recover. _(Unwanted)_
6. WHERE condition, THE system SHALL act. _(Optional)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.earsPatterns).toContain('WHEN');
            expect(result.earsPatterns).toContain('IF');
            expect(result.earsPatterns).toContain('THEN');
            expect(result.earsPatterns).toContain('SHALL');
            expect(result.earsPatterns).toContain('WHILE');
            expect(result.earsPatterns).toContain('WHERE');
        });

        it('detects no EARS keywords', () => {
            const content = `## Requirements

### Requirement 1: Test

1. The system should test.
2. When triggered, the system responds.
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(false);
            expect(result.earsPatterns).toHaveLength(0);
            expect(result.errors.some(e => e.includes('No EARS patterns detected'))).toBe(true);
        });

        it('detects partial EARS keywords', () => {
            const content = `## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_
2. WHEN triggered, THE system SHALL respond. _(Event-driven)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.earsPatterns).toContain('WHEN');
            expect(result.earsPatterns).toContain('SHALL');
            expect(result.valid).toBe(true);
        });
    });

    describe('acceptance criteria numbering', () => {
        it('detects numbered acceptance criteria', () => {
            const content = `## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_
2. WHEN triggered, THE system SHALL respond. _(Event-driven)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(true);
        });

        it('detects no numbered acceptance criteria', () => {
            const content = `## Requirements

### Requirement 1: Test

- THE system SHALL test.
- WHEN triggered, THE system SHALL respond.
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No 1.1, 1.2, etc. numbering found'))).toBe(true);
        });

        it('detects decimal numbered acceptance criteria', () => {
            const content = `## Requirements

### Requirement 1: Test

1.1 THE system SHALL test. _(Ubiquitous)_
1.2 WHEN triggered, THE system SHALL respond. _(Event-driven)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('handles empty content', () => {
            const result = verifyRequirementsFile('');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('handles content with only whitespace', () => {
            const result = verifyRequirementsFile('   \n\n   ');
            expect(result.valid).toBe(false);
        });

        it('handles content with markdown formatting', () => {
            const content = `# Requirements Document

## Introduction

**Bold** and *italic* text.

## Glossary

| Term | Definition |
|------|------------|
| test | \`code\` |

## Requirements

### Requirement 1: Test

1. THE system SHALL test. _(Ubiquitous)_
`;

            const result = verifyRequirementsFile(content);
            expect(result.valid).toBe(true);
        });
    });
});
