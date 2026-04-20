# hotfix — Hotfix Review

**Posture:** Compressed

## Primary Focus

- Scope minimization — does this change do *only* what is needed to resolve the production issue?
- Correctness of the emergency fix
- Is there a rollback plan?
- Are there immediate post-fix documentation requirements?

## Secondary Focus

- Follow-up task tracking for proper long-term fix
- Test coverage for the hotfix path

## What Blocks Approval

- The fix doesn't resolve the production issue
- The change introduces a safety or correctness regression
- Scope has crept beyond the minimal fix
- No rollback plan identified for a breaking change

## What Is Nit

- Style improvements not directly related to the fix
- Suggestions to refactor the changed code
- Requests to add functionality beyond the fix
- Naming improvements for code that will be replaced in follow-up

## Post-Review Note

After the hotfix merges, ensure a proper follow-up task exists to address the root cause properly.