# DIM-2: Behavioral Fidelity

**Question:** Does the new implementation match the OLD behavior exactly?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | New system produces bit-identical results for all test cases |
| 4 | New system matches old behavior for >95% of scenarios, minor acceptable differences |
| 3 | New system matches for common paths, gaps in edge cases |
| 2 | New system has significant behavioral deviations |
| 1 | New system fundamentally different from legacy |

## Audit Questions

1. For each behavior claimed as "replicated," show the legacy test that proves it
2. What behavioral differences exist between old and new? (List ALL of them)
3. For each difference, explain why it was an acceptable deviation
4. What tests prove behavioral equivalence? (Not just "tests pass")

## Evidence Requirements

- Behavioral comparison matrix (old behavior vs new behavior per feature)
- Test cases that reproduce legacy behavior
- Deviation log with justification for each acceptable change

## Auto-Fix

Not applicable — behavioral fidelity requires human verification.

## Probing Questions

- "Show me how the legacy system handles invalid input"
- "What happens in the old system when the database is unavailable?"
- "Are error messages identical between old and new?"