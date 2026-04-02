# Spec-Driven DoD Validation Skill

Validate that an implementation is ready to merge.

Run this gate after all tasks in `tasks.md` are marked complete, before
requesting a final review or opening a pull request. A failing DoD means
the implementation does not yet meet the agreed quality bar.

## When to Use

- After `spec-driven-task-implementer` marks all tasks `[x]`
- Before requesting a code review or merging
- When re-evaluating a previously rejected implementation

## Validation Workflow

```
1. READ specs/changes/<slug>/requirements.md
2. READ specs/changes/<slug>/design.md
3. READ specs/changes/<slug>/tasks.md
4. FOR EACH category below
   4.1 EVALUATE each item against the codebase and spec
   4.2 MARK as PASS / FAIL / NA
5. IF any required item is FAIL
   5.1 LIST the blocking items with a short explanation
   5.2 STOP — do not approve for merge
6. IF all required items PASS
   6.1 PRINT the DoD summary
   6.2 APPROVE for merge
```

## DoD Checklist

### Specification Compliance

| ID | Item | Required |
|----|------|----------|
| S-1 | Every REQ-* acceptance criterion has at least one passing test | Yes |
| S-2 | Every DES-* design element is implemented and traceable to code | Yes |
| S-3 | No implemented behavior contradicts requirements.md | Yes |
| S-4 | All tasks in tasks.md are marked `[x]` | Yes |

### Code Quality

| ID | Item | Required |
|----|------|----------|
| Q-1 | No new lint or type errors introduced | Yes |
| Q-2 | All new functions and modules follow STYLEGUIDE.md conventions | Yes |
| Q-3 | No TODO or placeholder comments left in production code | Yes |
| Q-4 | No secrets, credentials, or sensitive data committed | Yes |

### Testing

| ID | Item | Required |
|----|------|----------|
| TT-1 | All tests in the Acceptance Criteria Testing phase pass | Yes |
| TT-2 | No existing tests were broken by the change | Yes |
| TT-3 | Test names describe behavior, not REQ/DES identifiers | Yes |
| TT-4 | Test coverage does not regress from the baseline | No |

### Documentation

| ID | Item | Required |
|----|------|----------|
| D-1 | Public-facing behavior changes are reflected in docs or README | Yes |
| D-2 | AGENTS.md is updated if new agents, commands, or tools were added | Yes |
| D-3 | CHANGELOG updated via changeset (if user-facing change) | Yes |

### Design Integrity

| ID | Item | Required |
|----|------|----------|
| DI-1 | Implementation stays within boundaries defined in design.md | Yes |
| DI-2 | No new abstractions or modules introduced beyond the spec scope | Yes |
| DI-3 | Breaking changes are documented and communicated | Yes |

## Output Format

### When PASSED

```
✅ DoD VALIDATION: PASSED

Specification Compliance:  4/4
Code Quality:              4/4
Testing:                   3/4  (TT-4: N/A — no coverage baseline defined)
Documentation:             3/3
Design Integrity:          3/3

Implementation is READY for merge.
```

### When FAILED

```
❌ DoD VALIDATION: BLOCKED

Failing items:

- S-1 [FAIL]: REQ-2.2 (error path when token is expired) has no
  corresponding test. Add a test that covers this acceptance criterion.

- Q-3 [FAIL]: packages/cli/src/cli/inject.ts line 87 contains a TODO
  comment. Resolve or remove before merging.

- D-3 [FAIL]: No changeset found for this change. Run `pnpm changeset`
  and select the appropriate bump type.

Implementation is NOT READY. Fix the items above and re-validate.
```

## Clarification Policy

Do not ask clarifying questions during DoD validation. Evaluate what is
present in the codebase and spec. If an item cannot be evaluated because
a file or test does not exist, mark it FAIL with a note explaining what
is missing.

## Quality Bar (Self-Check)

Before reporting results, verify:

- [ ] Every checklist item has a PASS / FAIL / NA status
- [ ] Every FAIL includes a file path or line reference when applicable
- [ ] The summary counts are correct
- [ ] The final verdict matches the item results
- [ ] No implementation suggestions appear beyond fixing the failing items
