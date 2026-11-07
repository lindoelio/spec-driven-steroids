# Finding Severity Classification

For every finding, classify it into one of four levels before outputting
the review. This determines whether it blocks approval.

---

## Decision Tree

```text
Is this a blocking issue?
│
├── Does it degrade overall code health?
│   ├── Code is less maintainable, readable, or testable than before
│   ├── Complexity increased without justification
│   └── Tests coverage decreased
│
├── Does it violate a hard rule?
│   ├── Safety or security vulnerability
│   ├── Style guide — required rule violated
│   ├── Correctness bug (logic error, off-by-one, wrong assumption)
│   └── Missing or broken test that covers a claimed scenario
│
├── Does it introduce a regression?
│   ├── Functionality that previously worked is now broken
│   └── Performance degradation without justification
│
└── Is it an improvement opportunity?
    ├── Label: Nit: (optional polish — does not block)
    │   ├── Style preference not in the style guide
    │   ├── Minor readability improvement
    │   ├── Naming improvement suggestion
    │   └── Over-engineering (solving a future problem)
    │
    └── Label: Mentoring: (educational — does not block)
        ├── Teaches a language feature or framework pattern
        └── Shares knowledge that improves code health over time
```

**If any branching question in the "Does it degrade / violate /
regression" path is YES → Blocking (Must Fix)**

---

## Level Definitions

### Blocking — Must Fix

**Label:** *(no prefix)*

**Definition:** The finding must be addressed before the CL can be
approved. Without the fix, the overall code health of the codebase
would degrade.

**Examples:**

- Logic error that produces incorrect results
- Security vulnerability (injection, exposure of sensitive data,
  insufficient validation)
- Null pointer dereference or missing error handling that will
  cause crashes
- Style guide rule violated (required rule — not personal preference)
- Test that claims to cover a scenario but doesn't actually catch
  failures
- API change that breaks backward compatibility without migration
  path
- Over-engineering that creates an unmaintainable abstraction layer
- Race condition or deadlock in concurrent code
- Documentation that describes behavior that doesn't match the code

### Nit — Polish

**Label:** `Nit:`

**Definition:** A point of polish that could improve the code but is
not a gate. The author may choose to ignore it without blocking the
CL.

**Examples:**

- Variable name that is "good enough" but could be more descriptive
- Minor style preference not covered by the style guide
- Suggestion to use a language idiom that is more idiomatic
- Minor readability improvement
- Request to add a comment explaining something that is already clear
  from context
- Suggestion to extract a magic number into a named constant
- Minor code duplication that doesn't warrant immediate refactoring

**Rule:** Never block a CL based on a Nit finding.

### Mentoring — Educational

**Label:** `Mentoring:`

**Definition:** An educational comment that helps the author learn
something new. It is not a gate and should not block approval. The
author should feel free to ignore it.

**Examples:**

- Pointing out a language feature the author may not know
- Sharing a design pattern that could simplify the solution
- Explaining a framework convention the author should follow
- Sharing knowledge about performance characteristics of an approach
- Suggesting a book, article, or resource for further learning
- Noting a pattern that was done well and could be applied elsewhere

**Rule:** Label every mentoring comment explicitly so the author
knows it is educational.

### Approval with Notes — Scoped Sign-off

**Label:** `LGTM [with notes]:`

**Definition:** The reviewer has completed their scoped review and
is signing off. Other reviewers should address remaining findings.
Nits left open by author preference are noted.

**Use when:**

- You are one of multiple reviewers and have reviewed only certain
  files or aspects
- Your area of review is complete but other areas need attention from
  other reviewers
- The author has explicitly declined to address certain nits

**Rule:** Note explicitly which parts you reviewed and which remain
for other reviewers.

---

## Fixability Classification

After assigning severity, classify each finding by fixability. This
determines whether the agent can apply the fix autonomously.

### Fixability Levels

| Fixability | Label | Agent Action |
| --------- | ----- | ------------ |
| Can fix unambiguously | `direct-fix` | Apply immediately |
| Requires author judgment | `author-required` | Flag and continue |
| Educational / good-notice | `informational` | Note only |

### direct-fix

**Definition:** The fix is unambiguous — the agent can apply it
directly without guessing, inferring business intent, or making
architectural decisions.

**Examples:**

- Null check missing before dereference
- Missing test that reproduces a specific described bug
- Required style guide rule not followed (apply mechanically)
- Variable or function name not descriptive (rename — unambiguous)
- Missing `await` on an async call — the async function is clear
- Off-by-one in a known-safe range (apply known correct value)
- Hardcoded magic number — extract to a named constant
- Missing error handling on a known-throwing operation
- Comment explains what instead of why — rewrite the comment
- TODO or FIXME that can be removed (code already addressed it)

### author-required

**Definition:** The fix requires author judgment, domain knowledge,
or architectural decision that the agent cannot make confidently.
The agent flags it and continues.

**Examples:**

- Inverted business logic (is the condition supposed to be `> 0`?)
- Security vulnerability requiring architectural change
- Over-abstracted design — requires understanding intended scope
- Missing test that reproduces a non-deterministic bug
- API design decision — which interface shape is correct?
- Concurrency fix — requires understanding locking strategy
- Bug that could have multiple valid root causes

### informational

**Definition:** Mentoring or good-notice finding. The agent notes it
but does not apply a fix. Optionally applies if the suggestion is
trivial and the author has not explicitly declined.

**Examples:**

- Mentoring: "Consider using this pattern elsewhere"
- Good-notice: "This was done well"
- Suggestion to restructure that is purely stylistic
- Educational note about a language feature

---

## Decision Tree: Severity + Fixability

```text
Severity: Blocking?
│
├── YES → Fixability: direct-fix?
│         ├─ YES → Apply fix now, mark "fixed"
│         └─ NO  → Mark "author-required", continue
│
└── NO → Severity: Nit?
         ├─ YES → Fixability: direct-fix?
         │         ├─ YES → Apply fix, mark "fixed"
         │         └─ NO  → Mark "pending" or skip
         └─ NO  → Fixability: informational?
                   ├─ YES → Note as "Mentoring" / "Good Things"
                   └─ NO  → Note and skip
```

---

## Escalation Trigger

If a finding is `author-required` and blocking after two
self-repair passes:

1. Attempt to reach consensus using the escalation procedure in
   `references/escalation.md`.
2. If consensus cannot be reached, escalate to the appropriate
   party.
3. Mark the finding `escalated` in the final report.
4. Do not let a CL sit undecided.

---

## Comment Prefixes

Use these prefixes to label comment severity:

| Level | Prefix | Blocks Approval? |
| ----- | ------ | --------------- |
| Blocking | *(no prefix)* | Yes |
| Nit | `Nit:` | No |
| Mentoring | `Mentoring:` | No |
| Approval with Notes | `LGTM [with notes]:` | No |

**Format for a finding comment:**

```text
src/foo.ts:42 — Blocking [direct-fix]: Null check missing on
`user` object. Adding `if (!user) return null;` before line 43.

src/bar.ts:18 — Nit [direct-fix]: Variable name `x` not
descriptive. Renaming to `recordCount`.

src/baz.ts:55 — Mentoring: Nice use of early return to reduce
nesting. This pattern could also be applied in `src/qux.ts`.

src/quux.ts:10 — Blocking [author-required]: Inverted condition
logic — is the intended check `> 0` or `< 0`? Please confirm.
```
