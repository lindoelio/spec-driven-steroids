# Artifact-Type Guidance: Tasks

Guidance for auditing task lists (implementation plans, task breakdowns).

## What to Evaluate

### Completeness

- All tasks are present
- All design elements are covered
- All requirements have test coverage
- Dependencies are identified

### Correctness

- Task scope is appropriate
- Dependencies are valid
- Verification criteria are clear

### Consistency

- Task numbering is sequential
- Formatting is consistent
- Phases are logical

### Traceability

- Every task traces to DES
- Every REQ has test coverage
- Implementation tasks are distinct from test tasks

### Safety

- Risky tasks are identified
- Rollback tasks exist if needed

### Maintainability

- Tasks are atomic
- Task descriptions are clear
- Ordering is logical

## Red Team Questions (Confidence Gate)

When auditing tasks, adopt a rejector persona and answer these adversarial questions. You must find at least 3 plausible weaknesses before declaring confidence.

1. **Are any tasks too large for one focused session?** If a task title contains `and`, does it need splitting? Would a developer know exactly where to start and stop?
2. **Is every acceptance criterion covered by at least one test task?** Are there REQ-* acceptance criteria with no corresponding `Test:` task? Are test tasks grouped logically?
3. **Would executing these tasks in order break anything?** Are dependencies real and necessary, or artificially linear? Is there a hidden circular dependency?
4. **Are implementation tasks distinct from test tasks?** Is any implementation task secretly also a test? Are test tasks prefixed with `Test:` and focused on behavior?
5. **Is the Final Checkpoint actually final?** Does it verify all requirements, or just the happy path? Are there rollback or cleanup steps missing?
6. **Are risky tasks identified and mitigated?** Which task has the highest blast radius if it goes wrong? Is there a rollback task or contingency plan?