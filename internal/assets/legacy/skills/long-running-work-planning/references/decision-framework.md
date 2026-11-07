# Decision Framework

Guidance for deciding when to use durable long-running execution patterns and how to keep work resumable.

## Complexity Assessment Checklist

Before starting a large task, answer these questions:

1. Will this touch more than 5 files?
2. Will this require more than 10 distinct steps?
3. Could the agent lose useful context before finishing?
4. Does success depend on validation or test output?
5. Would it be harmful to restart from memory alone?
6. Are there multiple implementation tasks that can complete independently?

If 2 or more answers are yes, use durable execution.

## Timeout Risk Indicators

| Risk Factor | Low | Medium | High |
|-------------|-----|--------|------|
| Estimated steps | 1-5 | 6-10 | 10+ |
| Files affected | 1-2 | 3-5 | 5+ |
| Validation cost | None | One command | Multiple commands |
| Requirements clarity | Clear | Partial | Ambiguous |
| Dependencies | None | Internal | External |

Risk response:

- High risk: checkpoint before editing and after every verified task.
- Medium risk: checkpoint after each logical batch.
- Low risk: direct execution is acceptable.

## Durable Strategy Matrix

| Available Artifact | Strategy | Durable State |
|--------------------|----------|---------------|
| `tasks.md` | Queue execution | task markers and verification notes |
| phase artifact | one-phase planning | validated requirements/design/tasks file |
| no artifact yet | manual checkpointing | response checkpoints and created files |
| failing validation | blocker capture | exact command and failure summary |

## Task Sizing Rules

Good long-running tasks are small enough to verify independently.

- Split tasks that include unrelated code paths.
- Split tasks with “and” in the title unless the actions are inseparable.
- Prefer one behavior change per task.
- Include the expected verification command or check.
- Keep traceability tags attached to every implementation task.
- Avoid tasks that require broad rewrites without intermediate validation.

## Checkpoint Patterns

### Implementation Checkpoint

```md
Checkpoint:
- Completed: T-001, T-002
- Current: T-003 marked [~]
- Verification: pnpm test -- auth passed
- Next: T-004 add integration coverage
- Blockers: none
```

### Blocked Task Checkpoint

```md
Checkpoint:
- Completed: T-001
- Current: T-002 blocked
- Verification: pnpm test -- billing fails on missing test database
- Next: waiting for database fixture decision
- Blockers: test database URL is not configured
```

### Resume Summary

```md
Resume from here:
- Source of truth: .specs/changes/<slug>/tasks.md
- Next pending task: T-006
- Last successful validation: pnpm typecheck
- Known risk: integration tests not run because Docker unavailable
```

## Execution Decision Tree

```text
START
  |
  v
Is this a single-step task?
  |-- yes --> Execute directly
  |
  no
  v
Is there a durable artifact such as tasks.md?
  |-- yes --> Use it as the work queue
  |
  no
  v
Can you create a safe checkpoint artifact?
  |-- yes --> Create/update it, then work in batches
  |
  no
  v
Use visible response checkpoints after each logical batch
```

## Failure Handling

When validation fails:

1. Capture the exact command.
2. Capture the relevant failure message.
3. Decide whether the cause belongs to the current task.
4. Fix local current-task failures immediately when clear.
5. Mark blocked only when continuing would risk incorrect work.
6. Never mark complete without successful verification or an explicit verification limitation.

## Anti-Patterns

Avoid these behaviors:

- relying on private reasoning as the only progress record
- completing many tasks before updating `tasks.md`
- asking for permission between Phase 4 implementation tasks without a blocker
- marking work complete before verification
- creating huge tasks that cannot be resumed independently
- hiding validation failures until the final response
- restarting from memory instead of reading the durable artifact

Prefer these behaviors:

- task-by-task execution
- immediate status updates
- small targeted validation
- concise checkpoints
- explicit blockers with evidence
- resuming from files, not recollection
