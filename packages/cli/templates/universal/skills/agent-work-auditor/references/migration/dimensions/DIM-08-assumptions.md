# DIM-8: Silent Assumption Audit

**Question:** What did the agent assume without verification?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Zero assumptions — every claim verified with code evidence |
| 4 | Minor assumptions, all reasonable and validated post-hoc |
| 3 | Several assumptions, all reasonable and documented |
| 2 | Many assumptions, some questionable |
| 1 | Agent made critical assumptions without any verification |

## Audit Questions

1. What did you assume about the legacy system without reading the code?
2. For each assumption: what is the evidence that it is correct?
3. What assumptions proved incorrect during implementation?
4. How did you verify assumptions that couldn't be tested directly?

## Evidence Requirements

- Assumption log with verification status
- Code evidence for each verified assumption
- Post-verification correction log

## Common Assumptions

- "The system is thread-safe"
- "Session expires after X hours"
- "This API returns errors in format X"
- "This module doesn't depend on Y"
- "The database schema is normalized"

## Auto-Fix

Not applicable — assumption verification requires human judgment.

## Probing Questions

- "What did you assume about the legacy system without verification?"
- "How do you know the session timeout is 24 hours?"
- "What evidence do you have for assumption X?"