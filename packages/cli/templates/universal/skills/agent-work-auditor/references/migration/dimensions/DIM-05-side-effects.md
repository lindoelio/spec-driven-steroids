# DIM-5: Side Effect Audit

**Question:** What side effects exist that must be replicated?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | All side effects (logging, caching, events, mutations) replicated exactly |
| 4 | All significant side effects replicated, minor differences in timing/delivery |
| 3 | Major side effects replicated, some minor ones changed/removed |
| 2 | Major side effects missing or changed significantly |
| 1 | Side effects not considered or documented |

## Audit Questions

1. What side effects does the legacy system produce? (List ALL)
2. For each side effect: what is the trigger, what happens, what is the downstream impact?
3. How does the new system replicate each side effect?
4. For side effects NOT replicated, explain why and get explicit approval

## Evidence Requirements

- Side effect inventory with triggers and impacts
- New system side effect verification
- Change log for intentional side effect modifications

## Common Side Effects

- Logging to files or external systems
- Caching behavior
- Event emission
- Metrics/statistics collection
- Session state management
- Email/notification sending
- External API calls

## Auto-Fix

Not applicable — side effect verification requires human inspection.

## Probing Questions

- "What gets logged when a user logs in?"
- "Are there any scheduled jobs or cron tasks?"
- "What events does the system emit?"