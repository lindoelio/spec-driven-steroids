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
