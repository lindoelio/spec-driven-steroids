import { describe, it, expect } from 'vitest';
import { verifyTasksFile } from '-dist/index.js';

describe('MCP Unit: verifyTasksFile', () => {
    const validContent = `# Implementation Tasks

## Overview

This implements feature with 2 phases:

1. **Phase 1** - First phase
2. **Phase 2** - Second phase

**Estimated Effort**: Medium (3-5 sessions)

---

## Phase 1: First Phase

- [ ] 1.1 First task
  - Description of task
  - _Implements: DES-1, REQ-1.1_

- [ ] 1.2 Second task
  - Description of task
  - _Depends: 1.1_
  - _Implements: DES-1_

---

## Phase 2: Second Phase

- [ ] 2.1 Third task
  - Description of task
  - _Implements: DES-2, REQ-2.1_

---

## Phase 3: Final Checkpoint

- [ ] 3.1 Verify all acceptance criteria
  - REQ-1: Confirm test
  - REQ-2: Confirm test
  - Run tests, validate requirements
  - _Implements: All requirements_
`;

    describe('required sections', () => {
        it('validates content with Overview section', () => {
            const result = verifyTasksFile(validContent);
            expect(result.valid).toBe(true);
        });

        it('detects missing Overview section', () => {
            const content = validContent.replace('## Overview', '## Wrong');
            const result = verifyTasksFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Overview'))).toBe(true);
        });
    });

    describe('phase detection', () => {
        it('detects phase headers', () => {
            const result = verifyTasksFile(validContent);
            expect(result.phases.length).toBe(3);
            expect(result.phases[0]).toContain('Phase 1');
            expect(result.phases[1]).toContain('Phase 2');
            expect(result.phases[2]).toContain('Phase 3');
        });

        it('detects no phase headers', () => {
            const content = `# Tasks

## Overview

Test.

## Tasks

- [ ] Task 1
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No phase headers found'))).toBe(true);
        });

        it('detects multiple phases', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] Task

## Phase 2: Second

- [ ] Task

## Phase 3: Third

- [ ] Task

## Phase 4: Fourth

- [ ] Task
`;

            const result = verifyTasksFile(content);
            expect(result.phases.length).toBe(4);
        });
    });

    describe('Final Checkpoint phase', () => {
        it('detects Final Checkpoint phase', () => {
            const result = verifyTasksFile(validContent);
            expect(result.valid).toBe(true);
        });

        it('detects missing Final Checkpoint phase', () => {
            const content = validContent.replace('## Phase 3: Final Checkpoint', '## Phase 3: Wrong');
            const result = verifyTasksFile(content);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Final Checkpoint'))).toBe(true);
        });

        it('handles Final Checkpoint with different wording', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] Task

## Phase 2: Final Checkpoint

- [ ] Verify
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
        });
    });

    describe('task format', () => {
        it('detects checkbox format tasks', () => {
            const result = verifyTasksFile(validContent);
            expect(result.valid).toBe(true);
            expect(result.tasksFound).toBe(4);
        });

        it('detects no checkbox format tasks', () => {
            const content = `## Overview

Test.

## Phase 1: First

* Task 1
* Task 2
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No tasks in checkbox format found'))).toBe(true);
        });

        it('detects numbered tasks in checkbox format', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task
- [ ] 1.2 Task
- [ ] 2.1 Task
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
            expect(result.tasksFound).toBe(3);
        });

        it('detects invalid status markers', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [a] 1.1 Task
- [ ] 1.2 Task
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid status marker'))).toBe(true);
        });
    });

    describe('traceability', () => {
        it('detects traceability links', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Description
  - _Implements: DES-1, REQ-1.1_

- [ ] 1.2 Task 2
  - Description
  - _Implements: DES-2_

## Phase 2: Final Checkpoint

- [ ] 2.1 Verify
  - _Implements: All requirements_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
            expect(result.traceabilityReport.linked.length).toBe(2);
            expect(result.traceabilityReport.missingTraces).toHaveLength(0);
        });

        it('detects missing traceability links', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Description

- [ ] 1.2 Task 2
  - Description

## Phase 2: Final Checkpoint

- [ ] 2.1 Verify
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(false);
            expect(result.traceabilityReport.linked).toHaveLength(0);
            expect(result.traceabilityReport.missingTraces.length).toBe(2);
        });

        it('handles partial traceability', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Description
  - _Implements: DES-1_

- [ ] 1.2 Task 2
  - Description

- [ ] 1.3 Task 3
  - Description
  - _Implements: DES-2_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(false);
            expect(result.traceabilityReport.linked.length).toBe(2);
            expect(result.traceabilityReport.missingTraces.length).toBe(1);
        });
    });

    describe('dependency markers', () => {
        it('handles dependency markers', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Description
  - _Implements: DES-1_

- [ ] 1.2 Task 2
  - Description
  - _Depends: 1.1_
  - _Implements: DES-1_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
        });

        it('handles tasks without dependencies', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Description
  - _Implements: DES-1_

- [ ] 1.2 Task 2
  - Description
  - _Implements: DES-1_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('handles empty content', () => {
            const result = verifyTasksFile('');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('handles content with only whitespace', () => {
            const result = verifyTasksFile('   \n\n   ');
            expect(result.valid).toBe(false);
        });

        it('handles complex markdown formatting', () => {
            const content = `# Implementation Tasks

## Overview

**Bold** and *italic* text.

**Estimated Effort**: **Medium** (3-5 sessions)

---

## Phase 1: **First** Phase

- [ ] 1.1 **Task** with \`code\`
  - **Description** with \`code\`
  - _Implements: **DES-1**, \`REQ-1.1\`_

- [ ] 1.2 *Second* task
  - _Depends: **1.1**_
  - _Implements: \`DES-1\`_

---

## Phase 2: **Final** Checkpoint

- [ ] 2.1 Verify **all** acceptance criteria
  - **REQ-1**: Confirm \`test\`
  - Run tests, validate requirements
  - _Implements: **All requirements**_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
        });

        it('handles tasks with multi-line descriptions', () => {
            const content = `## Overview

Test.

## Phase 1: First

- [ ] 1.1 Task 1
  - Line 1 of description
  - Line 2 of description
  - Line 3 of description
  - _Implements: DES-1_
`;

            const result = verifyTasksFile(content);
            expect(result.valid).toBe(true);
        });
    });
});
