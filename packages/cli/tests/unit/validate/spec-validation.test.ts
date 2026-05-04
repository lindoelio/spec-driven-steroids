import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyDesignFile } from '../../../src/core/validate/design.js';
import { verifyTasksFile } from '../../../src/core/validate/tasks.js';
import { verifyCompleteSpec } from '../../../src/core/validate/spec.js';

const validRequirements = `# Requirements

## Requirements

### REQ-1: Login

**User Story:** As a user, I want login, so that I can access my account.

#### Acceptance Criteria
1.1 WHEN the user submits valid credentials, THEN the application SHALL create a session.
`;

const validDesign = `# Design Document

## Overview

Implement login through an authentication service.

## System Architecture

### DES-1: Authentication Service

Coordinates credential validation and session creation.

\`\`\`mermaid
flowchart TD
    A[Login Form] --> B[Authentication Service]
\`\`\`

_Implements: REQ-1.1_

## Code Anatomy

| File Path | Status | Evidence | Purpose | Implements |
|-----------|--------|----------|---------|------------|
| src/auth.ts | New | Proposed by DES-1 | Authentication service | DES-1 |

## Traceability Matrix

| Design Element | Requirements |
|----------------|--------------|
| DES-1 | REQ-1.1 |
`;

const validTasks = `# Implementation Tasks

## Overview

This implementation is organized into 3 phases.

## Phase 1: Foundation

- [ ] 1.1 Add authentication service
  - Create the service that validates credentials and creates sessions.
  - _Implements: DES-1, REQ-1.1_

## Phase 2: Acceptance Criteria Testing

- [ ] 2.1 Test: create session for valid credentials
  - Verify valid credentials create a session.
  - Test type: integration
  - _Implements: REQ-1.1_

## Phase 3: Final Checkpoint

- [ ] 3.1 Verify all acceptance criteria
  - Confirm all requirements are covered.
  - _Implements: All requirements_
`;

describe('Unit: hallucination-resistant spec validation', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('fails design validation for nonexistent requirement references', () => {
    const design = validDesign.replace('REQ-1.1', 'REQ-9.9');

    const result = verifyDesignFile(design, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('REQ-9.9'))).toBe(true);
  });

  it('fails task validation for implementation tasks without DES traceability', () => {
    const tasks = validTasks.replace('DES-1, ', '');

    const result = verifyTasksFile(tasks, validDesign, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('does not reference a design element'))).toBe(true);
  });

  it('fails task validation for missing dependency targets', () => {
    const tasks = validTasks.replace('  - _Implements: DES-1, REQ-1.1_', '  - _Depends: 9.9_\n  - _Implements: DES-1, REQ-1.1_');

    const result = verifyTasksFile(tasks, validDesign, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.errorType === 'Dependency Error')).toBe(true);
  });

  it('fails complete spec validation when a sub-artifact is invalid', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'sds-spec-'));
    const specDir = path.join(tempDir, '.specs', 'changes', 'login');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(path.join(specDir, 'requirements.md'), validRequirements.replace('WHEN', 'When'));
    writeFileSync(path.join(specDir, 'design.md'), validDesign);
    writeFileSync(path.join(specDir, 'tasks.md'), validTasks);

    const result = await verifyCompleteSpec('login', tempDir);

    expect(result.valid).toBe(false);
    expect(result.requirementsErrors.length).toBeGreaterThan(0);
  });
});
