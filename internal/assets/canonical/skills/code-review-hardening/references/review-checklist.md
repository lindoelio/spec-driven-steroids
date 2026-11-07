# Review Checklist

For each file reviewed, read every line. Understand it or explicitly
note why it was scoped out. Apply the dimensions below, adjusted by
the change type's primary and secondary focus from
`references/change-type-strategies.md`.

For each dimension, the auto-fix prompt tells the agent what to do
if the issue is found and the fix is unambiguous. If the fix is
ambiguous, mark `author-required` and continue.

---

## 1. Design

**Always evaluate this.** The most important dimension — cover it
first.

- Do the interactions between pieces make sense?
- Does this change belong in the codebase, or should it be a library?
- Does it integrate well with the rest of the system?
- Is now a good time to add this functionality?
- Is the design scalable — will it hold as usage grows?

**For feat:** Challenge the design rigorously. Is the abstraction
correct? Are responsibilities properly separated?

**For refactor:** Verify no design changes occurred — only structural
improvement with behavioral parity.

**For migrate:** Verify backward compatibility of the design. Are
interfaces being removed or changed incompatibly?

**Auto-fix prompt:** If a naming or organization issue is found
(e.g., file in wrong directory, module name not matching purpose),
mark `author-required` — design decisions require architectural
judgment.

---

## 2. Functionality

**Always evaluate this.** Focus on whether the code does what the
author intended and whether that intent is good for users.

- Does the code do what the developer intended?
- Is what was intended good for the end users?
- Edge cases — have all meaningful inputs been considered?
- Concurrency — are there potential deadlocks or race conditions?
- Does it fail gracefully for unexpected inputs?

**For fix:** Focus on the specific bug. Verify the fix actually
resolves it. Look for the same pattern elsewhere.

**For hotfix:** Focus on correctness of the emergency fix. Minimal
scope only.

**For feat:** Think like a user. Could a user find this feature
confusing? Are the interactions sensible?

**Auto-fix prompt:** If an obviously missing guard is found (null
check, bounds check, early return for invalid input), apply it as a
`direct-fix`. If the logic itself appears incorrect (wrong operator,
wrong value, inverted condition), mark `author-required`.

---

## 3. Complexity

**Always evaluate this.** "Too complex" means "can't be understood
quickly by code readers" or "developers are likely to introduce bugs
when modifying this code."

- Are individual lines too complex (deeply nested, many conditions)?
- Are functions too complex (too many responsibilities)?
- Are classes too complex (god objects)?
- Is there over-engineering — solving problems that don't exist yet?

**For hotfix:** Flag any complexity that goes beyond the minimal fix
needed.

**For refactor:** This is the primary dimension. Is complexity
reduced? Is the code easier to understand?

**For feat:** Block future-proofing that isn't needed. Solve today's
problem well.

**Auto-fix prompt:** If a function is too long (> ~40 lines) or too
deeply nested, consider extracting a clearly-named sub-function as a
`direct-fix` — if the extracted logic is unambiguous. If the refactor
requires understanding the business logic to split correctly, mark
`author-required`.

---

## 4. Tests

**Always evaluate this.** Tests must be correct, sensible, and useful
— they don't test themselves.

- Are appropriate tests present (unit, integration, or end-to-end)?
- Tests added in the same CL as production code (unless emergency)?
- Do tests actually fail when the code is broken?
- Do tests produce false positives when code changes beneath them?
- Are assertions simple and useful?
- Are tests separated appropriately between different test methods?

**For fix:** A test that reproduces the bug and passes with the fix
is mandatory. Always verify this.

**For migrate:** Migration tests covering data integrity and backward
compatibility are mandatory.

**For hotfix:** Tests may be minimal. Post-fix cleanup should improve
coverage.

**For refactor:** Test coverage must not decrease. If it does, block.

**Auto-fix prompt:** If a test is missing for a specific bug that has
a clear reproduction scenario, write the test as a `direct-fix` — the
reproduction steps are the fix. If the test would require mocking a
complex environment or the bug is non-deterministic, mark
`author-required`.

---

## 5. Naming

**Always evaluate this.** Good names are long enough to communicate
meaning without being unreadably long.

- Does every name (variable, function, class, module) clearly
  communicate what it is or does?
- Is naming consistent with project conventions?
- Is naming consistent within the changed file?

**For feat:** Thorough naming review is primary. Clear names are the
first line of documentation.

**For docs:** Not applicable (no code naming to review).

**Auto-fix prompt:** If a name is not descriptive (e.g., `x`,
`temp`, `data`, `foo`), rename it to something that reflects its
content or purpose as a `direct-fix`. If the renaming could break
an external API or is a personal preference not covered by style
guide, mark `author-required`.

---

## 6. Comments

**Always evaluate this.** Comments should explain *why* code exists,
not *what* it is doing. If the code isn't clear enough to explain
itself, simplify the code first.

- Are comments clear and in understandable English?
- Are comments necessary — do they explain *why*, not *what*?
- Is there dead or outdated comments (TODOs that can be removed,
  old advisory comments)?
- Are there comments in before-this-CL code that are now outdated?

**For refactor:** Comments should be preserved. If comments are
removed, verify they weren't needed for explanation.

**Note:** Comments are distinct from documentation (class/module/
function docs). Documentation should express purpose, usage, and
behavior.

**Auto-fix prompt:** If a comment explains *what* instead of *why*
and the code is clear enough to stand alone, either delete the
comment or rewrite it to explain the *why* as a `direct-fix`. If a
TODO is found and the work is already done, remove the TODO as a
`direct-fix`. If a comment describes behavior that no longer matches
the code, mark `author-required`.

---

## 7. Style

**Always evaluate this** against the project style guide or the
language's standard style guide.

- Does the code conform to the project's style guide?
- If no project style guide exists, does it conform to the language's
  standard style guide?
- Are purely personal style preferences labeled `Nit:` — not gates?

**For feat, fix, migrate:** Style compliance is a hard requirement
when a style guide exists.

**For hotfix:** Style can be deferred — minimal scope only.

**For docs:** Not applicable (style refers to code style).

**For refactor:** Style must not degrade. If the refactor makes style
worse, block.

**Auto-fix prompt:** If a required style rule is violated (whitespace,
indentation, import order, naming convention in a style guide),
apply the fix mechanically as a `direct-fix`. If the style preference
is not in the style guide and is a personal taste, mark `Nit:` and
do not apply.

---

## 8. Consistency

**Always evaluate this.** Resolve conflicts between local code and
the style guide.

- Is existing code inconsistent with the style guide? If so, the
  style guide takes priority.
- If no other rule applies, the author should be consistent with the
  existing codebase.
- Encourage filing a bug and adding a TODO for cleanup of inconsistent
  code.

**For feat:** Consistent with existing codebase unless that would
worsen code health.

**For migrate:** Consistency review covers backward compatibility.
Ensure changes don't break existing patterns without justification.

**Auto-fix prompt:** If the fix requires making the code consistent
with an existing pattern that is clearly defined in the codebase
(e.g., following an established naming pattern, matching an existing
helper function signature), apply it as a `direct-fix`. If the fix
requires changing the existing pattern (not just matching it), mark
`author-required`.

---

## 9. Documentation

**Evaluate when the CL changes how users build, test, interact with,
or release code.**

- Does associated documentation need updating (READMEs, generated
  docs, API docs)?
- Does the CL delete or deprecate code — should related docs be
  deleted too?
- Is documentation missing where it should exist?

**For feat:** Documentation for new features is mandatory. Verify the
README or relevant docs are updated.

**For docs:** The documentation change itself is the review target.
Verify technical accuracy and clarity.

**For hotfix:** Post-incident documentation may be required. Verify
that incident context is captured.

**For migrate:** Migration documentation is critical. Document the
change, the rollback plan, and any steps users must take.

**Auto-fix prompt:** If a README or doc comment is outdated (refers
to an old flag, an old file path, or old behavior) and the new
behavior is clear from the code, update the doc as a `direct-fix`.
If the documentation requires explaining a new design decision, mark
`author-required`.

---

## Every Line

For every file reviewed:

1. Read every line of human-written code.
2. Understand what it does — if you don't understand it, note why
   and flag it for clarification.
3. Do not scan over code you don't understand and assume it's fine.
4. If understanding the code requires domain knowledge you don't
   have, note this and suggest a reviewer with the appropriate
   expertise.

**Context check:** Look at the whole file, not just the changed
lines. A change that looks fine in isolation may cause problems in
context (e.g., a 4-line addition inside a 60-line function that
should be refactored first).

---

## Good Things

Call out what was done well. Encouragement and appreciation are part
of the review. Tell the author when they did something right — it is
often more valuable than pointing out what went wrong.
