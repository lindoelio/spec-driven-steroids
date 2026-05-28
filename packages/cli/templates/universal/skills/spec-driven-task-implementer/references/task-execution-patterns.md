# Task Execution Patterns

Use this reference when deciding how to resume work, verify a small change, or respond to a failed verification loop.

## Smallest Meaningful Verification

- Template text change: targeted template or prompt-contract test first.
- Inject flow change: focused integration test for inject behavior.
- Workflow automation change: targeted workflow or packaging test first, then broader suite if needed.

## Interrupted Work Pattern

1. Read `tasks.md`.
2. Find any `- [~]` task.
3. Check whether the code already satisfies the task.
4. Re-run the smallest relevant verification before marking it complete.

## Verification Failure Pattern

1. Keep the task `- [~]`.
2. Fix the smallest issue exposed by the failing test.
3. Re-run the targeted verification.
4. Escalate only if the failure reveals a real spec conflict.

## Task Amendment Pattern

When a task discovers additional in-scope work:

1. Confirm the work maps to existing `REQ-*` and `DES-*` scope.
2. Add a new pending task in the current or next appropriate phase.
3. Include `_Discovered from: <task-id or discovery target>_`.
4. Include `_Implements: DES-X, REQ-Y.Z_`.
5. Continue only after the amendment is recorded.

Stop for mini-review if the discovery changes requirements, architecture, public contracts, migrations, security posture, or operational risk.

## Final Coverage Matrix Pattern

Before declaring implementation complete, summarize each acceptance criterion:

| Requirement | Implemented Behavior | Files Changed | Covering Test | Verification Command | Gap/Rationale |
|-------------|----------------------|---------------|---------------|----------------------|---------------|
| REQ-1.1 | Invalid input is rejected before persistence | src/example/service.ts | rejects invalid input | pnpm test -- example | None |
