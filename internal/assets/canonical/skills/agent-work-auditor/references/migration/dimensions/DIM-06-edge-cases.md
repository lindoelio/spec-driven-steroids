# DIM-6: Edge Case Coverage

**Question:** Are existing edge cases the agent may have missed handled?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | All documented AND undocumented edge cases identified and handled |
| 4 | >90% of edge cases handled, minor gaps in very rare scenarios |
| 3 | Major edge cases handled, some undocumented ones missed |
| 2 | Common edge cases handled, significant undocumented cases missed |
| 1 | Only obvious happy-path scenarios handled |

## Audit Questions

1. What edge cases exist that are NOT documented?
2. How did you discover undocumented edge cases?
3. For each edge case: what is the trigger, what happens, how is it handled?
4. What is your confidence that ALL edge cases were found?

## Evidence Requirements

- Edge case inventory (documented + discovered)
- Test cases covering each edge case
- Methodology for discovering undocumented edge cases

## Common Edge Cases

- Empty input / null values
- Maximum load / overflow
- Concurrent access / race conditions
- Network failures / timeouts
- Partial success / rollback scenarios
- Authentication edge cases
- Permission boundaries

## Auto-Fix

Cannot auto-fix — edge case discovery requires human analysis.

## Probing Questions

- "What happens when the input is empty?"
- "What is the maximum supported request size?"
- "How does the system behave under concurrent load?"