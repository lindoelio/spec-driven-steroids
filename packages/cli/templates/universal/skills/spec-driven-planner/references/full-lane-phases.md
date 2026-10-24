# Full-Lane Phases

Read this reference only when the full lane is selected. Lane selection and transitions are defined in `lane-selection.md`; artifact formats belong to the phase skills.

## Lifecycle

In the full lane, you MUST enforce this lifecycle exactly:

`requirements -> design -> tasks -> Red Team Review -> implementation -> Code Review`

- Never skip full-lane phases, even if the user asks to implement immediately.
- In the full lane, if there is no approved `.specs/changes/<slug>/requirements.md`, always start with requirements.
- In the full lane, before Phase 4 is explicitly approved by the human, do not write implementation code.
- In the full lane, before Phase 4 approval, only write the active spec files under `.specs/changes/<slug>/`: requirements.md, design.md, tasks.md. Archived snapshots from an explicitly approved lane transition may coexist under `.archive/`.
- Every full-lane phase transition requires explicit human approval.

### Terminology

A **phase** is a gate that requires human or sub-agent approval to proceed. Internal steps (writing artifacts, running validation, self-checks) are not phases.

| Phase | Gate Type |
|-------|-----------|
| Phase 1: Requirements | Human approval |
| Phase 2: Design | Human approval |
| Phase 3: Tasks | Human approval |
| Red Team Review | Sub-agent gate (auto-triggered when supported) |
| Phase 4: Implementation | Human approval |
| Code Review | Sub-agent gate (auto-triggered when supported) |

### Non-Skippable Stop Rule

This rule applies to the full lane.

- In a single user turn, you may complete at most one planning phase.
- After finishing Phase 1, Phase 2, or Phase 3, you MUST stop in the same response after summarizing the artifact and asking for approval.
- Do not start the next phase in the same response, even if you believe the user probably wants you to continue.
- Treat approval as explicit only when the user clearly says to proceed, continue, or approve the next phase.
- If approval is missing or ambiguous, stop and wait.

If the user asks for direct implementation in the full lane, respond with:

"SDS requires an approved planning artifact before implementation. This change requires the full lane, so I must start with Phase 1 (requirements), write `.specs/changes/<slug>/requirements.md`, and ask for approval. For implementation without planning, use the host harness outside SDS."

## Workflow

This section applies only to the full lane.

At the start of each planning phase, load the `long-running-work-planning` skill when it is available before invoking the phase-specific skill. Use it to checkpoint progress, keep work aligned with durable artifacts, and make long-running phases resumable.

### Mandatory Context Preflight

Before invoking any phase-specific skill, you MUST collect and pass repository context into that skill invocation:

- Read available project guideline files relevant to the phase (`AGENTS.md`, `ARCHITECTURE.md`, `STYLEGUIDE.md`, `TESTING.md`, `SECURITY.md`).
- Invoke `contextual-stewardship` in `inject` or `retrieve` mode for the current phase (`requirements`, `design`, `tasks`, or `implementation`).
- For design and implementation phases, inspect targeted existing code patterns with `Glob`, `Grep`, and `Read` before proposing file placement, abstractions, naming, or tests.
- Summarize the applicable constraints and pattern evidence in the phase artifact or implementation notes.
- If guidelines, contextual memory, and code evidence conflict, stop and resolve the conflict before continuing.

### Phase Orchestration

When invoking any spec-driven phase skill, follow this sequence:

1. Run the mandatory context preflight
2. Invoke the phase skill with the collected context
3. Wait for the skill to produce its artifact
4. Write the artifact to the appropriate file path
5. Run the Unified Quality Gate (see shared protocol)
6. **STOP** — Do NOT invoke the next skill or continue to the next phase
7. Summarize the artifact, declare verdict, and ask for explicit human approval

The skill's output does NOT mean the phase is complete. You MUST stop after the Quality Gate and await approval before proceeding.

### Phase 1: Requirements

Invoke the `spec-driven-requirements-writer` skill.

1. Propose a short, URL-friendly slug.
2. Use the user request as input for `.specs/changes/<slug>/requirements.md`.
3. Load the `long-running-work-planning` skill at the start of the phase when available.
4. Run the mandatory context preflight for `requirements` and pass the results to the skill.
5. Invoke the `spec-driven-requirements-writer` skill.
6. Wait for the skill to produce requirements content.
7. Write `.specs/changes/<slug>/requirements.md`.
8. Run the Unified Quality Gate.
9. **STOP**. Summarize the artifact, declare verdict, and ask for approval.
10. Do not begin design work until the user explicitly approves Phase 1.

### Phase 2: Design

Invoke the `spec-driven-technical-designer` skill.

1. Use approved `requirements.md` as the source of truth.
2. Load the `long-running-work-planning` skill at the start of the phase when available.
3. Run the mandatory context preflight for `design` and pass the results to the skill.
4. Invoke the `spec-driven-technical-designer` skill.
5. Wait for the skill to produce design content.
6. Write `.specs/changes/<slug>/design.md`.
7. Run the Unified Quality Gate.
8. **STOP**. Summarize the artifact, declare verdict, and ask for approval.
9. Do not begin task decomposition until the user explicitly approves Phase 2.

### Phase 3: Tasks

Invoke the `spec-driven-task-decomposer` skill.

1. Use approved `requirements.md` and `design.md`.
2. Load the `long-running-work-planning` skill at the start of the phase when available.
3. Run the mandatory context preflight for `tasks` and pass the results to the skill.
4. If Code Anatomy coverage is not `Exhaustive`, execute every `Discovery Target` before decomposition and record Target, Result, and Plan impact evidence.
5. If discovery changes approved architecture, public contracts, scope, security posture, or operational risk, stop and return to Phase 2 review.
6. Invoke the `spec-driven-task-decomposer` skill with the completed discovery evidence.
7. Wait for the skill to produce tasks content.
8. Write `.specs/changes/<slug>/tasks.md` with `## Discovery Evidence` when coverage is non-exhaustive. Do not emit a discovery/inventory implementation task.
9. Ensure every implementation-bearing phase contains at least one `Test:` task.
10. Run the Unified Quality Gate.
11. **STOP**. Summarize the artifact, declare verdict, and ask for approval.
12. Do not begin implementation until the user explicitly approves Phase 3.

### Red Team Review

**Triggered after Phase 3 approval, before Phase 4 starts.**

This is an adversarial review of the complete specification (`requirements.md`, `design.md`, `tasks.md`), performed by a separate reviewer when the host supports sub-agent spawning.

**Platform detection:** Use any available sub-agent spawning capability, regardless of tool name. Otherwise fall back to structured inline adversarial review and disclose that it is not independent.

**Sub-agent delegation protocol:**

Launch a Red Team reviewer through the host's spawning interface. Adapt role and parameter names to that interface:

- `subagent_type`: `general`
- `description`: `Red Team Review for <slug>`
- Prompt: provide a standalone brief containing:
  - The three spec artifact paths: `.specs/changes/<slug>/requirements.md`, `.specs/changes/<slug>/design.md`, `.specs/changes/<slug>/tasks.md`.
  - The Red Team Reviewer role instructions below.
  - Instruction to return a structured verdict (`PASS`, `PASS WITH NOTES`, or `FAIL`) with classified findings.

**Red Team Reviewer role:**
- Read all three spec artifacts.
- Use the Red Team questions in `agent-work-auditor/artifacts/{requirements,design,tasks}.md` as guidance.
- Focus on **cross-artifact** issues: traceability gaps, requirement↔design mismatches, task coverage holes, scope creep, ambiguous acceptance criteria.
- Produce findings classified as `blocking` or `non-blocking`.
- Blocking findings must be resolved before implementation starts.

**Verdict:**
- `PASS` — No blocking findings. Proceed to Phase 4.
- `PASS WITH NOTES` — No blocking findings, non-blocking concerns documented. Proceed to Phase 4.
- `FAIL` — Blocking findings exist. Fix and re-run Red Team Review.

**Inline fallback:**
- If spawning is unavailable, perform the Red Team Review yourself. Adopt the rejector persona, read the same artifacts, apply the same cross-artifact focus, cite findings and evidence, and produce the same structured verdict. Label the review inline, not independent.

After Red Team Review passes, ask the user: `Red Team Review: PASS. Approve entry to Phase 4 (implementation)?`

### Phase 4: Implementation

**Only enter Phase 4 after explicit human approval of Phase 3 and Red Team Review.**

Invoke the `spec-driven-task-implementer` skill.

- Use `requirements.md`, `design.md`, and `tasks.md` as the source of truth.
- Run the mandatory context preflight for `implementation` before selecting the first task.
- Execute the requested task, requested phase, or next eligible pending task.
- Update task status in `tasks.md` per task:
  - mark `[~]` when starting
  - mark `[x]` only after verification succeeds
  - save the file immediately after each status change
- Keep REQ and DES IDs inside `_Implements:` traceability tags in `tasks.md`; use behavior-focused names for tests and test cases.
- Use the smallest meaningful verification for each task before marking it complete.
- If implementation discovers additional in-scope work under existing `REQ-*`/`DES-*`, use the Task Amendment Protocol in `tasks.md` instead of treating it as scope creep.
- If discovered work changes requirements, architecture, public contracts, migration scope, security posture, or operational risk, stop for mini-review before proceeding.
- Continue implementation directly unless blocked by a real conflict, failed verification, or material ambiguity.
- After all implementation tasks complete, trigger Code Review.

### Code Review

**Triggered after all tasks in `tasks.md` are marked `[x]`.**

This is a comprehensive implementation review performed by a separate reviewer when spawning is available.

**Platform detection:** Use any available sub-agent spawning capability, regardless of tool name. Otherwise fall back to structured inline adversarial review and disclose that it is not independent.

**Sub-agent delegation protocol:**

Launch a Code Reviewer through the host's spawning interface. Adapt role and parameter names to that interface:

- `subagent_type`: `general`
- `description`: `Code Review for <slug>`
- Prompt: provide a standalone brief containing:
  - The spec artifact paths: `.specs/changes/<slug>/requirements.md`, `.specs/changes/<slug>/design.md`, `.specs/changes/<slug>/tasks.md`.
  - The list of changed implementation files (from `git diff --name-only` against the base branch).
  - The Code Reviewer role instructions below.
  - Instruction to invoke `agent-work-auditor` with the `spec-driven` extension and `universal-live-check` for final validation.
  - Instruction to return a structured verdict.

**Code Reviewer role:**
- Read the spec artifacts and all changed implementation files.
- Invoke `agent-work-auditor` with `spec-driven` extension.
- Invoke `universal-live-check` for final validation.
- Verify implementation traces to `DES-*` and `REQ-*`.
- Produce a structured verdict.

**Verdict:**
- `APPROVE` — Implementation is complete and correct.
- `APPROVE WITH NOTES` — Implementation is complete, non-blocking concerns documented.
- `REQUEST CHANGES` — Blocking findings exist. Fix and re-run Code Review.

**Inline fallback:**
- If spawning is unavailable, perform the Code Review yourself. Read the same artifacts, invoke the same skills, cite source/diff and observed verification results, and produce the same structured verdict. Label the review inline, not independent. Failed or unobserved required verification cannot be approved.

After Code Review passes, declare: `Implementation complete. Code Review: APPROVE.`

## Traceability Rules

- Preserve traceability across the full flow:
  - requirements use `REQ-*`
  - design uses `DES-*`
  - tasks link work through `_Implements:` tags
- Do not invent alternate traceability ID systems.

## Key Behaviors

- Always validate via CLI before presenting a planning artifact as complete.
- Never claim validation passed unless the command was actually run against the written file and its output was observed.
- Explicitly invoke the specialized skill for each phase.
- Write planning artifacts first, then ask for approval between phases.
- After a planning artifact is written, stop immediately and wait for approval.
- **Never invoke the next planning-phase skill immediately after one completes.** Always stop, summarize, and ask for approval first.
- During implementation, do the work directly and ask only when blocked or when approval is required to move into Phase 4.
- Never batch task status updates.

## Constraints

- **Never skip the approval gate**: In either lane, you MUST stop after writing the planning artifact and wait for explicit approval before implementation or the next full-lane phase.
- In the full lane, do not edit files outside `.specs/changes/<slug>/` before Phase 4 approval.
- Do not write implementation code before the selected lane's explicit implementation approval.
- Keep wrapper behavior aligned with the universal skills rather than adding platform-specific process rules.
