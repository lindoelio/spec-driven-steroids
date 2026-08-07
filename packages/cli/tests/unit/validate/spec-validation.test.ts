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

### Coverage Declaration

Coverage: Exhaustive

### Required Touchpoints

| File Path | Status | Evidence | Purpose | Implements |
|-----------|--------|----------|---------|------------|
| src/auth.ts | New | Proposed by DES-1 | Authentication service | DES-1 |

### Known Impact Surface

| Path or Area | Evidence | Why It Matters | Related DES |
|--------------|----------|----------------|-------------|
| src/auth.test.ts | Verified by Glob | Authentication tests | DES-1 |

### Discovery Targets

| Target | Method | Purpose | Related Requirements |
|--------|--------|---------|----------------------|
| auth exports | Grep for auth | Confirm no additional entrypoints | REQ-1.1 |

### Out of Scope

| Path or Area | Rationale |
|--------------|-----------|
| src/legacy-auth.ts | Legacy auth is not part of this change |

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

  it('fails design validation without Code Anatomy coverage declaration', () => {
    const design = validDesign.replace('Coverage: Exhaustive', '');

    const result = verifyDesignFile(design, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('coverage declaration'))).toBe(true);
  });

  it('fails task validation when non-exhaustive Code Anatomy has no discovery evidence', () => {
    const design = validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative');

    const result = verifyTasksFile(validTasks, design, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('discovery evidence is missing'))).toBe(true);
  });

  it('accepts completed Phase 3 discovery evidence without an implementation discovery task', () => {
    const design = validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative');
    const tasks = validTasks.replace('## Phase 1: Foundation', `## Discovery Evidence

- Target: \`Grep for auth exports\`
  - Result: \`src/auth.ts\` and \`src/auth.test.ts\`
  - Plan impact: Tasks 1.1 and 2.1 cover the discovered surface

## Phase 1: Foundation`);

    const result = verifyTasksFile(tasks, design, validRequirements);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('allows legitimate angle-bracket syntax in discovery evidence', () => {
    const design = validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative');
    const tasks = validTasks.replace('## Phase 1: Foundation', `## Discovery Evidence

- Target: \`Grep for auth exports\`
  - Result: \`Map<string, Session>\` usage in \`src/auth.ts\`
  - Plan impact: Task 1.1 covers the discovered surface

## Phase 1: Foundation`);

    expect(verifyTasksFile(tasks, design, validRequirements).valid).toBe(true);
  });

  it('rejects incomplete Phase 3 discovery evidence', () => {
    const design = validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative');
    const tasks = validTasks.replace('## Phase 1: Foundation', `## Discovery Evidence

- Target: \`Grep for auth exports\`
  - Result: \`src/auth.ts\`

## Phase 1: Foundation`);

    const result = verifyTasksFile(tasks, design, validRequirements);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('Discovery Evidence is incomplete'))).toBe(true);
  });

  it('allows Test: tasks in implementation phases while keeping Acceptance Criteria Testing penultimate', () => {
    const tasks = `# Implementation Tasks

## Overview

This implementation is organized into 4 phases.

## Phase 1: Foundation

- [ ] 1.1 Add authentication service
  - Create the service that validates credentials and creates sessions.
  - _Implements: DES-1, REQ-1.1_

- [ ] 1.2 Test: verify authentication service creates sessions
  - Confirm valid credentials create a session.
  - Test type: integration
  - _Depends: 1.1_
  - _Implements: REQ-1.1_

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

    const result = verifyTasksFile(tasks, validDesign, validRequirements);

    expect(result.valid).toBe(true);
  });

  it('accepts legacy discovery-first task plans with a warning', () => {
    const design = validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative');
    const tasks = `# Implementation Tasks

## Overview

This implementation is organized into 3 phases.

## Phase 1: Foundation

- [ ] 1.1 Inventory implementation touchpoints
  - Execute the design's Discovery Targets and update this task plan if additional in-scope files are found.
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

    const result = verifyTasksFile(tasks, design, validRequirements);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(warning => warning.message.includes('Legacy discovery task accepted'))).toBe(true);
  });

  it('propagates legacy discovery warnings through complete spec validation', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'sds-spec-'));
    const specDir = path.join(tempDir, '.specs', 'changes', 'login');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(path.join(specDir, 'requirements.md'), validRequirements);
    writeFileSync(path.join(specDir, 'design.md'), validDesign.replace('Coverage: Exhaustive', 'Coverage: Representative'));
    writeFileSync(path.join(specDir, 'tasks.md'), `# Implementation Tasks

## Overview

This implementation is organized into 3 phases.

## Phase 1: Foundation

- [ ] 1.1 Inventory implementation touchpoints
  - Execute the design's Discovery Targets.
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
`);

    const result = await verifyCompleteSpec('login', tempDir);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(warning => warning.message.includes('Legacy discovery task accepted'))).toBe(true);
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
