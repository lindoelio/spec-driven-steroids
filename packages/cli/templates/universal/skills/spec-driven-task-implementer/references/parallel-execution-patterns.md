# Parallel Execution Patterns

Use this reference when spawning sub-agent tasks on platforms that support the `Task` tool (e.g., OpenCode). These patterns assume the implementer has already verified all dependency and safety preconditions.

## Dependency Graph Walkthrough

Given this `tasks.md` snippet:

```
- [x] 1.1 Inventory implementation touchpoints
- [x] 1.2 Add request entry point
- [x] 1.3 Add authorization service
  _Depends: 1.2_
- [ ] 2.1 Add denial feedback path
  _Depends: 1.3_
- [ ] 2.2 Add audit logging for denied actions
  _Depends: 1.3_
- [ ] 3.1 Test: reject non-administrator protected actions
  _Depends: 1.3_
- [ ] 3.2 Test: allow administrator protected actions
  _Depends: 1.3_
```

After Phase 1 is complete (1.1, 1.2, 1.3 are `[x]`), the dependency graph resolves to:

- **Independent batch 1**: 2.1, 2.2 (both depend only on 1.3, which is done)
- **Sequential after batch 1**: 3.1, 3.2 (depend on 1.3, but check file overlap with batch 1)

Check `_Implements:` file sets before spawning. If 2.1 and 2.2 touch different files, spawn both in parallel. If they touch the same files, execute sequentially.

## Safe Parallel Batch Pattern

A safe batch is a set of tasks where:
1. All dependencies are `[x]`
2. No cross-dependency within the batch
3. Non-overlapping `_Implements:` file sets

```
Launch sub-agents for:
  - task 2.1 (touches src/feedback.ts, tests/feedback.test.ts)
  - task 2.2 (touches src/audit.ts, tests/audit.test.ts)
Files are non-overlapping → safe for parallel
```

## Unsafe Parallel Batch Pattern

```
Do NOT launch sub-agents for:
  - task 2.1 (touches src/service.ts, src/feedback.ts)
  - task 2.2 (touches src/service.ts, src/audit.ts)
src/service.ts overlaps → execute sequentially
```

## Sub-Agent Prompt Template

Use this template when constructing the `Task` prompt for each sub-agent:

```
Implement Spec-Driven task <task-id>: <task title> from .specs/changes/<slug>/tasks.md.

Context files:
- .specs/changes/<slug>/requirements.md
- .specs/changes/<slug>/design.md
- .specs/changes/<slug>/tasks.md

Task to implement:
<copy the full task line and description from tasks.md, including _Implements: and any _Discovered from: tags>

Rules:
1. Read tasks.md, find this task, mark it - [~] and save.
2. Implement only the scoped behavior required by this task.
3. Follow design.md for architecture and file placement.
4. Follow STYLEGUIDE.md and surrounding code for naming and patterns.
5. Run the smallest meaningful verification.
6. If verification passes, mark the task - [x] and save tasks.md.
7. If verification fails, keep the task at - [~] and fix.

Return:
- Changed files: list of files modified or created
- Verification outcome: passed or failed
- Task status: [x] or [~]
- Any discovery notes for the orchestrator
```

## Batch Size Guidelines

- Preferred: 2-4 tasks per batch
- Maximum: 6 tasks per batch
- If more than 6 independent tasks exist, split into multiple batches and execute sequentially across batches
- Start with the smallest batch first to validate the pattern before scaling

## Result Reconciliation

After all sub-agents in a batch complete, read `tasks.md` and verify:

1. Every task in the batch is `- [x]`
2. No unexpected files were changed (compare each sub-agent's file list against the design's Code Anatomy)
3. If any task failed:
   - Diagnose: was it a spec conflict, a real bug, or a transient issue?
   - Fix sequentially before spawning the next batch
   - If the fix affects already-completed tasks in the same batch, re-verify them too

## When To Avoid Parallelism

- Single task requested by user → sequential by definition
- Fewer than 2 independent tasks → sequential is fine
- Tasks touching shared infrastructure (configs, types, database schema) → sequential
- First implementation on a new codebase → sequential until patterns are validated
- User explicitly requests sequential execution
