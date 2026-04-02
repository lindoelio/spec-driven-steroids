# Spec-Driven DoR Validation Skill

Validate that a feature is ready to move from requirements to design.

Run this gate after `requirements.md` is written and approved, before
the technical designer begins `design.md`. A failing DoR means the
requirements are not yet stable enough to design against.

## When to Use

- After `spec-driven-requirements-writer` produces `requirements.md`
- Before invoking `spec-driven-technical-designer`
- At any point when the team questions whether a feature is well-defined

## Validation Workflow

```
1. READ specs/changes/<slug>/requirements.md
2. FOR EACH category below
   2.1 EVALUATE each item
   2.2 MARK as PASS / FAIL / NA
3. IF any required item is FAIL
   3.1 LIST the blocking items with a short explanation
   3.2 STOP — do not proceed to design
4. IF all required items PASS
   4.1 PRINT the DoR summary
   4.2 PROCEED to spec-driven-technical-designer
```

## DoR Checklist

### Clarity

| ID | Item | Required |
|----|------|----------|
| C-1 | Every REQ-* has a clear, single user story | Yes |
| C-2 | All acceptance criteria use valid EARS syntax | Yes |
| C-3 | No acceptance criterion contains implementation details | Yes |
| C-4 | All domain terms used in requirements are defined in the Glossary | Yes |

### Completeness

| ID | Item | Required |
|----|------|----------|
| CO-1 | At least one HAPPY_PATH acceptance criterion per requirement | Yes |
| CO-2 | Error and edge cases are covered for requirements with side effects | Yes |
| CO-3 | All external actors and systems are named | Yes |
| CO-4 | Performance or SLA constraints are stated if they affect design | No |

### Feasibility

| ID | Item | Required |
|----|------|----------|
| F-1 | No requirement contradicts another | Yes |
| F-2 | No requirement depends on a system or API that does not yet exist | Yes |
| F-3 | Scope is small enough to fit in one `design.md` | Yes |

### Traceability

| ID | Item | Required |
|----|------|----------|
| T-1 | All REQ-* IDs are unique and sequential | Yes |
| T-2 | Acceptance criteria are numbered as `<req>.<criterion>` (e.g. `1.1`) | Yes |

## Output Format

### When PASSED

```
✅ DoR VALIDATION: PASSED

Clarity:       4/4
Completeness:  3/4  (CO-4: N/A — no SLA constraints)
Feasibility:   3/3
Traceability:  2/2

Feature is READY for design.
Proceed to: spec-driven-technical-designer
```

### When FAILED

```
❌ DoR VALIDATION: BLOCKED

Failing items:

- C-4 [FAIL]: Terms "settlement" and "clearing" are used in REQ-3 but
  not defined in the Glossary. Add definitions before proceeding.

- CO-2 [FAIL]: REQ-2 modifies account balance but has no ERROR_CASE
  criterion for insufficient funds.

Feature is NOT READY. Fix the items above and re-validate.
```

## Clarification Policy

Do not ask clarifying questions during DoR validation. Your role is to
evaluate what is written and report what is missing. If a required item
cannot be evaluated because the information does not exist, mark it FAIL
with a note explaining what is needed.

## Quality Bar (Self-Check)

Before reporting results, verify:

- [ ] Every checklist item has a PASS / FAIL / NA status
- [ ] Every FAIL includes a short, actionable explanation
- [ ] The summary counts are correct
- [ ] The final verdict (PASSED / BLOCKED) matches the item results
- [ ] No design or implementation suggestions appear in the report
