---
name: code-review-hardening
description: Use this skill for rigorous, structured code review with a self-repair loop. Applies change-type-aware strategies (feat, fix, hotfix, refactor, migrate, docs). Findings are severity-classified, then auto-fixed where possible. Triggers on PR reviews, code review requests, or when reviewing any change set.
---

# Code Review Hardening

Strengthen code against defects through systematic, type-aware review.
Every reviewed line is understood or explicitly scoped-out. Findings are
classified by severity and fixability. The agent applies direct fixes
autonomously and re-reviews before producing a final report.

## Gotchas

**Passive review is incomplete:** A static report is a human review.
For an autonomous agent, after classifying findings the skill must
enter the self-repair loop — apply fixes, re-review, iterate.

**Wrong strategy for the type:** A hotfix and a new feature require
opposite postures. Applying a full-scope `feat` review to a `hotfix`
causes unnecessary delay. Always determine the change type first.

**Blocking on style preference:** Only block on style if the project's
style guide explicitly requires it. Personal style preferences are
`Nit:` — never gates.

**Skipping lines:** Every human-written line must be understood or
explicitly scoped-out with a note.

**Mentoring vs. blocking:** Label every educational comment
`Mentoring:` so the author knows it is not a gate.

**Over-engineering:** Block implementations that solve future problems
the author doesn't know they'll face. Solve today's problem well.

## Quick Start

```text
Input:  Files or directories to review, optional change type tag
        (feat | fix | hotfix | refactor | migrate | docs)
Output: Structured markdown review report with fix status

Workflow:
1. Determine change type (auto-detect or explicit)
2. Gather project context (style guide, conventions, docs)
3. Review per type strategy — read every line
4. Classify findings by severity AND fixability
5. Self-repair loop — apply direct fixes, re-review (max 2 passes)
6. Author review — remaining author-required items
7. Final verdict + escalation if needed
```

## Activation

Load this skill when:

- User asks for a code review of any kind
- User mentions PR review, pull request review, code review, change
  review, or review this
- User asks to review specific files, a branch, or a diff
- User wants feedback on a CL (changelist)

Do NOT load this skill for:

- Simple one-liner fixes the user already validated
- Questions about code that don't involve reviewing a change
- Formatting-only tasks (convert JSON to YAML, etc.)

## Determine Change Type

Detect the change type in priority order:

1. **Explicit tag:** User provides a type tag (`feat`, `fix`,
   `hotfix`, `refactor`, `migrate`, `docs`). Use directly.

2. **Branch name scan:** Check the branch name for conventional-commit
   prefixes:

   - `feat/` → `feat`
   - `fix/` → `fix`
   - `hotfix/` → `hotfix`
   - `refactor/` → `refactor`
   - `chore/` → `migrate`
   - `docs/` → `docs`

3. **Commit message scan:** Examine the last 5 commit messages for
   conventional-commit prefixes (`feat:`, `fix:`, `hotfix:`,
   `refactor:`, `chore:`, `docs:`). Use the most frequent prefix.

4. **Heuristic guess:** If no prefix found, infer from prompt language:
   "bug fix" / "fix this" → `fix`; "hot patch" / "production
   issue" → `hotfix`; "restructure" / "clean up" → `refactor`;
   "migrate" / "upgrade" → `migrate`; "update docs" / "add readme"
   → `docs`; otherwise → general-purpose review.

5. **Fallback:** If no signal and no confident guess, apply a balanced
   general-purpose review across all types.

## Pre-flight

Before reviewing, gather project context:

1. Check for a project style guide (search for `STYLEGUIDE.md`,
   `.styleguide`, `style-guide.md`, or inline `style` references).
2. Check for existing review conventions or patterns (search for
   `REVIEW_GUIDELINES.md`, `CONTRIBUTING.md`, or established comment
   styles).
3. Check for relevant subsystem documentation related to the changed
   files.
4. Load `references/change-type-strategies.md` to get the review
   strategy for the detected type.

If no project conventions are found, proceed with general standards.

## Review Workflow

### Phase 1: Determine Type

Run the type detection chain above.

### Phase 2: Load Type Strategy

Read `references/change-type-strategies.md` for the detected type.

### Phase 3: Pre-flight

Gather project context: style guide, conventions, relevant docs.

### Phase 4: Review per Type

Apply the focused checklist from `references/review-checklist.md`,
adjusting depth per type. For every file: read every line, understand
it or note why it was scoped out.

### Phase 5: Classify Findings

Read `references/finding-severity.md` to classify each finding:

**Step A — Severity:**

- Blocking — must fix before approval
- Nit — optional polish, not a gate
- Mentoring — educational, not a gate

**Step B — Fixability (new):**

- `direct-fix` — fix is unambiguous, agent applies it now
- `author-required` — fix requires author judgment or is ambiguous
- `informational` — mentoring or good-notice finding

### Phase 6: Self-Repair Loop

Apply direct fixes autonomously. Max 1 pass.

**Pass 1:**

1. For every `direct-fix` blocking finding: apply the fix.
2. Re-read modified files to verify fix didn't break anything.
3. Re-review modified files and their immediate callers for new
   blocking findings.
4. If new blocking findings appear: rollback the fix, mark original
   finding as `author-required`.
5. If no new blocking findings: mark original finding as `fixed`.
6. Collect remaining unfixed `direct-fix` items.

After 1 pass, any remaining `direct-fix` items are marked
`author-required` and escalated via `references/escalation.md`.

### Phase 7: Author Review

Remaining `author-required` findings are output in the final report
with clear `Decision Needed` descriptions. The agent does not guess.

### Phase 8: Final Verdict + Escalation

- If no blocking findings remain: **Approve**
- If `author-required` blocking findings remain: **Request Changes**
- If your scoped review is complete but other areas need other
  reviewers: **Approval with Notes**

Any unresolved `author-required` finding that blocks approval is
escalated via `references/escalation.md`.

## Type-Selected Priorities

| Type | Urgency | Risk | Primary Focus | Secondary | Threshold |
| ---- | ------- | ---- | ------------- | --------- | --------- |
| `feat` | Medium | Medium | Design, scalability | Tests, edge cases | Full |
| `fix` | High | Medium | Bug repro, fix verification | Test case | Full |
| `hotfix` | Critical | High | Scope min., correctness | Rollback | Minimal |
| `refactor` | Low | Med-High | Behavioral parity, DRY | Readability | Full |
| `migrate` | Med-High | High | Compat, schema | Migration tests | Full |
| `docs` | Low | Low | Grammar, correctness, code | — | Minimal only |
| General | Medium | Medium | All dimensions equally | — | Full |

For detailed per-type goals, posture, and block-vs-nit guidance,
read `references/change-type-strategies.md`.

## Severity Taxonomy

| Level | Label | Prefix | Blocks Approval? |
| ----- | ----- | ------ | --------------- |
| Blocking | Must Fix | *(no prefix)* | Yes |
| Nit | Polish | `Nit:` | No |
| Mentoring | Educational | `Mentoring:` | No |
| Approval with Notes | Scoped sign-off | `LGTM [with notes]:` | No |

**Blocking criteria** (read `references/finding-severity.md` for the
full decision tree):

- Code health degrades — overall maintainability, readability, or
  testability worsens
- Safety violation — security vulnerability, memory leak, unhandled
  error
- Style guide violation — required style point not followed
- Correctness bug — logic error, off-by-one, wrong assumption, missing
  edge case
- Missing or broken tests — test doesn't cover the scenario it claims

**Nit criteria:**

- Style preference not in the style guide
- Minor readability improvement
- Over-engineering suggestions for future needs
- Naming that is "good enough" but could be more descriptive

**Mentoring criteria:**

- Teaches a language feature, framework pattern, or design principle
- Shares knowledge that improves code health over time

## Output Format

Produce this structured markdown report:

```markdown
# Code Review — {change-type}

**Branch:** {branch-name-or"N/A"}
**Files reviewed:** {n} ({list or "see below"})
**Verdict:** Approve | Request Changes | Approval with Notes

## Summary
{2-3 sentence overall assessment of code health impact}

## Direct Fixes Applied
| File | Line | Finding | Fix Applied | Status |
| ---- | ---- | ------- | ----------- | ------ |
| src/foo.ts | 42 | Null check missing | Add `if (!user) return null;` | fixed |

## Blocking Findings (Author Required)
| File | Line | Finding | Decision Needed | Status |
| ---- | ---- | ------- | -------------- | ------ |
| src/bar.ts | 18 | Inverted condition | Confirm: `> 0` or `< 0`? | pending |

## Nit Findings
| File | Line | Finding | Suggestion | Status |
| ---- | ---- | ------- | ---------- | ------ |
| src/baz.ts | 55 | Non-descriptive name `x` | Rename to `recordCount` | fixed |

## Mentoring / Good Things
| File | Line | Observation |
| ---- | ---- | ----------- |
| src/qux.ts | 12 | Nice early return pattern |

## Escalation Record (if any)
{from references/escalation.md}
```

**Fix Status values:**

- `fixed` — auto-fixed by the agent in the self-repair loop
- `pending` — awaiting author decision
- `escalated` — passed to escalation path after max iterations

**Verdict definitions:**

- **Approve** — All blocking findings resolved. CL improves code
  health and is merge-ready.
- **Request Changes** — `author-required` blocking findings present.
  Author must address before approval.
- **Approval with Notes** — Your scoped review is complete. Other
  reviewers should address remaining findings. Nits left open by
  author preference are noted.

## Reference Loading

Load reference files on demand, not upfront:

| File | When to Load |
| ---- | ------------ |
| `references/change-type-strategies.md` | Phase 2 of review workflow |
| `references/review-checklist.md` | Phase 4 of review workflow |
| `references/finding-severity.md` | Phase 5 of review workflow |
| `references/escalation.md` | Phase 8 — only when escalation is needed |
