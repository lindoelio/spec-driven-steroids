# Change Type Strategies

Each change type has a distinct review posture. Select the strategy
matching the detected type before reviewing.

---

## feat — New Feature

**Goal:** Architectural alignment, maintainability, and adequate test
coverage for new functionality.

**Urgency:** Medium | **Risk:** Medium

**Primary focus:**

- Overall design — do the interactions between pieces make sense?
- Does the feature belong in this codebase or should it be a library?
- Does it integrate well with the rest of the system?
- Is now a good time to add this functionality?
- Scalability — will this design hold as usage grows?

**Secondary focus:**

- Naming clarity and consistency
- Test coverage for all functional requirements
- Edge cases and error paths
- Documentation of the new feature

**Review posture:** Thorough. Dig into design decisions. Challenge
over-engineering. Verify tests cover new functionality.

**What blocks approval:**

- Design flaw that will cause problems at scale
- Missing tests for core functionality
- Security or correctness issues
- Violation of project style guide (required rules)

**What is Nit:**

- Suggestion to name something more descriptively
- Minor style preferences not in the style guide
- Requests to add functionality that isn't needed now

---

## fix — Bugfix

**Goal:** Verify the fix resolves the bug without introducing
regressions or masking the root cause.

**Urgency:** High | **Risk:** Medium

**Primary focus:**

- Does the fix actually resolve the reported bug?
- Is there a test that reproduces the bug and now passes?
- Could the fix introduce a regression in other paths?
- Is the root cause addressed or just the symptom?
- Are there related edge cases the fix doesn't cover?

**Secondary focus:**

- Test quality — new test must be correct and useful
- Whether the bug was an edge case worth handling
- If the fix is a workaround vs. a proper correction

**Review posture:** Focused. Examine the specific code change and
its immediate impact. Verify a test case exists that reproduces the
bug and passes with the fix. Look for the same pattern elsewhere
that might also be broken.

**What blocks approval:**

- Fix doesn't actually resolve the bug
- No test case that reproduces the bug
- Fix masks the root cause without addressing it
- Introduces a new correctness or safety issue
- Violates project style guide (required rules)

**What is Nit:**

- Style preferences not in the style guide
- Suggestion to improve variable naming
- Request to add more tests beyond the bug-repro test

---

## hotfix — Hotfix

**Goal:** Immediate, urgent resolution of production issues with
minimal blast radius and maximum speed.

**Urgency:** Critical | **Risk:** High

**Primary focus:**

- Scope minimization — does this change do *only* what is needed
  to resolve the production issue?
- Correctness of the emergency fix
- Is there a rollback plan?
- Are there immediate post-fix documentation requirements?

**Secondary focus:**

- Follow-up task tracking for proper long-term fix
- Test coverage for the hotfix path

**Review posture:** Compressed. Restrict review to the minimal
files that resolve the production issue. Do not allow scope creep
(no refactoring, no feature additions, no style fixes). Accept that
a rushed hotfix may have technical debt — document it and track it
for later cleanup.

**What blocks approval:**

- The fix doesn't resolve the production issue
- The change introduces a safety or correctness regression
- Scope has crept beyond the minimal fix
- No rollback plan identified for a breaking change

**What is Nit:**

- Style improvements not directly related to the fix
- Suggestions to refactor the changed code
- Requests to add functionality beyond the fix
- Naming improvements for code that will be replaced in follow-up

**Post-review note:** After the hotfix merges, ensure a proper
follow-up task exists to address the root cause properly.

---

## refactor — Refactoring

**Goal:** Improve internal structure without changing external
behavior. If the behavior changed, it's not a refactor.

**Urgency:** Low | **Risk:** Medium-High

**Primary focus:**

- Behavioral parity — does the refactored code produce identical
  results to the original?
- No behavior change (output, performance, error handling)
- Readability improvements
- Code deduplication and DRY principles
- Removal of dead code

**Secondary focus:**

- Whether the refactoring enables the next logical step
- Test coverage is maintained or improved
- Whether the change is actually an improvement in code health

**Review posture:** Rigorous on behavioral parity. Every refactor
must produce code that behaves identically to the original. If the
behavior changed, it's not a refactor — it's a feature change.
Look for readability improvements, elimination of duplication, and
improved naming.

**What blocks approval:**

- Any behavioral change between original and refactored code
- Reduced test coverage
- Increased complexity without improvement
- Introduction of a safety or correctness issue
- Violation of project style guide (required rules)

**What is Nit:**

- Style preferences not in the style guide
- Naming suggestions that don't materially improve clarity
- Requests to restructure code in ways that don't improve readability
  or reduce duplication

---

## migrate — Migration / Dependency Upgrade

**Goal:** Update dependencies or move data without downtime.
Critical attention on backward compatibility, schema changes, and
rollback readiness.

**Urgency:** Medium-High | **Risk:** High

**Primary focus:**

- Backward compatibility — is the change backward compatible with
  existing consumers?
- Database schema changes — are they safe? Do they preserve data?
- Rollback plan exists and is tested
- Migration tests cover the data path

**Secondary focus:**

- API or interface changes that break existing callers
- Dependency version conflicts
- Configuration changes that affect deployment

**Review posture:** Cautious. Schema changes and migrations are
high-risk. Verify rollback plans exist. Check that all consumers of
changed interfaces are updated. Confirm migration tests are in
place.

**What blocks approval:**

- Breaking backward compatibility without a migration path
- Database schema change that loses data
- No rollback plan for a destructive change
- Migration tests missing or inadequate
- Dependency upgrade introduces a security vulnerability
- Violation of project style guide (required rules)

**What is Nit:**

- Suggestion to use a newer API pattern in the migration
- Minor dependency version bumps not directly related
- Style preferences not in the style guide

---

## docs — Documentation

**Goal:** Keep documentation accurate, clear, and up to date. Code
examples must be correct.

**Urgency:** Low | **Risk:** Low

**Primary focus:**

- Grammar, spelling, and clarity of writing
- Technical accuracy of all statements
- Correctness of code examples
- Whether the documentation reflects the actual behavior of the code
- Are all necessary pieces documented (installation, usage, API)?

**Secondary focus:**

- Consistent terminology
- Appropriate level of detail for the target audience

**Review posture:** Lightweight. Focus on accuracy and clarity. Code
examples must be correct and executable. Do not block on style
preferences unless they affect clarity. Minor readability improvements
are `Nit:`.

**What blocks approval:**

- Technical inaccuracies in the documentation
- Code examples that are incorrect or misleading
- Missing documentation for newly added public interfaces
- Security-sensitive content exposed in docs without proper warnings
- Violation of project style guide (required rules, e.g., required
  sections or format)

**What is Nit:**

- Minor grammar or spelling issues that don't affect clarity
- Suggestion to add a clarifying example
- Style preferences not in the style guide
- Requests to add more detail on topics adequately covered
