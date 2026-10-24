# Parallel Execution Patterns

Use this reference when the host supports sub-agent spawning, regardless of tool name. These patterns assume approval, dependency, file-ownership, and serialized-ledger preconditions have been verified.

## Dependency Graph Walkthrough

Given this `tasks.md` snippet:

```
- [x] 1.1 Add request entry point
- [x] 1.2 Add authorization service
  _Depends: 1.1_
- [ ] 2.1 Add denial feedback path
  _Depends: 1.2_
- [ ] 2.2 Add audit logging for denied actions
  _Depends: 1.2_
- [ ] 3.1 Test: reject non-administrator protected actions
  _Depends: 1.2_
- [ ] 3.2 Test: allow administrator protected actions
  _Depends: 1.2_
```

After Phase 1 is complete (1.1 and 1.2 are `[x]`), the dependency graph resolves to:

- **Independent batch 1**: 2.1, 2.2 (both depend only on 1.2, which is done)
- **Sequential after batch 1**: 3.1, 3.2 (depend on 1.2, but check file overlap with batch 1)

Resolve actual file touchpoints from the tasks and linked design before spawning. `_Implements:` lists IDs, not paths. If file sets overlap, execute sequentially.

## Safe Parallel Batch Pattern

A safe batch is a set of tasks where:
1. All dependencies are `[x]`
2. No cross-dependency within the batch
3. Non-overlapping actual file sets and a single owner for serialized task-ledger updates

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

Use this template with the host's available spawning interface:

```
Implement Spec-Driven task <task-id>: <task title> from .specs/changes/<slug>/tasks.md.

Context files:
- .specs/changes/<slug>/requirements.md
- .specs/changes/<slug>/design.md
- .specs/changes/<slug>/tasks.md

Task to implement:
<copy the full task line and description from tasks.md, including _Implements: and any _Discovered from: tags>

Rules:
1. Read the assigned task; the orchestrator already marked it [~] and owns serialized ledger writes.
2. Implement only the scoped behavior required by this task.
3. Follow design.md for architecture and file placement.
4. Follow STYLEGUIDE.md and surrounding code for naming and patterns.
5. Run the smallest meaningful verification.
6. If verification passes, return evidence and proposed [x] status; do not concurrently rewrite tasks.md.
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

After all sub-agents in a batch complete, reconcile results and save verified [x] transitions serially in `tasks.md`:

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
