# fix — Bugfix Review

**Posture:** Focused

## Primary Focus

- Does the fix actually resolve the reported bug?
- Is there a test that reproduces the bug and now passes?
- Could the fix introduce a regression in other paths?
- Is the root cause addressed or just the symptom?
- Are there related edge cases the fix doesn't cover?

## Secondary Focus

- Test quality — new test must be correct and useful
- Whether the bug was an edge case worth handling
- If the fix is a workaround vs. a proper correction

## What Blocks Approval

- Fix doesn't actually resolve the bug
- No test case that reproduces the bug
- Fix masks the root cause without addressing it
- Introduces a new correctness or safety issue
- Violates project style guide (required rules)

## What Is Nit

- Style preferences not in the style guide
- Suggestion to improve variable naming
- Request to add more tests beyond the bug-repro test
- Request to fix related issues that weren't part of the original bug