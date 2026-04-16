---
description: Start the spec-driven workflow at Phase 1 requirements
agent: Spec-Driven
---

Start Spec-Driven planning for this request:

$ARGUMENTS

Use the `spec-driven` agent for this request.

Command behavior:
- Begin at Phase 1 (requirements).
- Enforce the full lifecycle: `requirements -> design -> tasks -> implementation`.
- Load `long-running-work-planning` at the start of each planning phase when it is available.
- Do not implement code yet.
- Propose a slug and draft `specs/changes/<slug>/requirements.md`.
- Write `specs/changes/<slug>/requirements.md` first, validate it, then ask for human approval before moving to design.
- After Phase 1 is written, stop immediately.
- Do not start Phase 2, Phase 3, or Phase 4 in the same turn.
- Wait for explicit approval before continuing to the next phase.