# Escalation Procedure

When the author and reviewer cannot reach consensus on a finding,
follow this escalation procedure. The goal is resolution — not to
let a CL sit undecided indefinitely.

---

## When to Escalate

Escalate when any of these conditions are met:

1. The author and reviewer disagree on whether a finding is blocking
   or a nit, and two rounds of discussion have not resolved the
   disagreement.
2. The finding involves a trade-off between competing priorities
   (e.g., correctness vs. speed, maintainability vs. delivery).
3. The finding requires a decision that affects multiple teams or a
   shared library.
4. The author or reviewer feels that the disagreement is blocking
   progress and neither is willing to defer to the other.

---

## Escalation Levels

Escalate through these levels in order:

### Level 1: Synchronous Discussion

Before escalating, the author and reviewer should attempt a
synchronous discussion (video call, in-person meeting, or a live
chat session).

**Why synchronous:** Text-based discussions easily produce
misunderstandings and tone misreads. A 10-minute call can resolve
what would take a day of text exchanges.

**Procedure:**

1. The reviewer summarizes their position and the author summarizes
   theirs.
2. Both share their underlying assumptions.
3. Together, find a solution that satisfies both positions or
   identify which principle takes priority.
4. Record the outcome as a comment on the CL for future readers.

### Level 2: Team Discussion

If Level 1 fails, bring in a broader team perspective:

1. Post a summary of the disagreement in the team's communication
   channel (Slack, Teams, etc.).
2. Include the relevant code snippet and both positions.
3. Request input from other senior engineers or team members.
4. Accept the team's consensus — even if it differs from your
   initial position.
5. Record the outcome as a comment on the CL.

### Level 3: Technical Lead Weigh-in

If the team cannot reach consensus:

1. Request a decision from the Technical Lead (TL) responsible for
   the affected code area.
2. Provide the TL with: the relevant code, both positions, and the
   team discussion outcome.
3. Accept the TL's decision.
4. Record the outcome as a comment on the CL.

### Level 4: Maintainer Decision

If the code affects a shared library or component with a designated
maintainer:

1. Request a decision from the maintainer.
2. Provide the same context as Level 3.
3. Accept the maintainer's decision.
4. Record the outcome as a comment on the CL.

### Level 5: Engineering Manager Involvement

If the disagreement persists and is blocking a critical business
deadline:

1. Involve the Engineering Manager (EM) responsible for the team.
2. The EM may facilitate a resolution or make a final call.
3. Accept the EM's decision.
4. Record the outcome as a comment on the CL.

---

## Recording Outcomes

Every escalation must be recorded as a comment on the CL for future
readers, even if the outcome was "no change needed."

**Required fields in the escalation comment:**

```text
## Escalation Record

**Date:** YYYY-MM-DD
**Issue:** Brief description of the disagreement
**Positions:**
- Author: [author's position]
- Reviewer: [reviewer's position]
**Resolution:** [what was decided and why]
**Escalation Level:** [1-5]
```

---

## Principles

- **Don't let CLs sit.** If the author and reviewer can't agree,
  escalate. Silence is not a resolution.
- **The reviewer's responsibility includes ownership of the code they
  review.** If you believe a finding is blocking and the author
  disagrees, you are obligated to escalate — not to approve something
  you believe degrades code health.
- **The author's progress matters.** If a reviewer is being
  unreasonable (demanding perfection, blocking on personal style
  preferences, not applying the right type strategy), the author
  should escalate without fear.
- **Technical facts and data overrule opinions and personal
  preferences.** Bring data to escalation discussions. If you can
  demonstrate with evidence that one approach is superior, that
  evidence should drive the decision.
- **When in doubt, err toward improving code health.** If a CL is
  clearly improving code health but has a debatable finding, it's
  better to approve with a note than to block on a nit.
