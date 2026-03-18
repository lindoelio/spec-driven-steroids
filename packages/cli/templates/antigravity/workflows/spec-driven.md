---
name: Spec-Driven
description: Full Spec-Driven flow (Requirements -> Design -> Tasks -> Code).
---

# Spec-Driven Implementation

Guide the user from an idea to validated requirements, validated design, validated tasks, and then implementation.

## Phase Gatekeeper

You MUST enforce this lifecycle exactly:

`requirements -> design -> tasks -> implementation`

- Never skip phases, even if the user asks to implement immediately.
- If there is no approved `specs/changes/<slug>/requirements.md`, always start with requirements.
- Before Phase 4 is explicitly approved by the human, do not write implementation code.
- Before Phase 4 approval, only write files under `specs/changes/<slug>/`.
- Every phase transition requires explicit human approval.
- For requirements, design, and tasks, always validate and write the artifact first, then ask whether to proceed.

If the user asks for direct implementation before requirements, respond with:

"I can implement this, but per Spec-Driven flow I must start with Phase 1 (requirements) first. I will propose a slug, write `specs/changes/<slug>/requirements.md`, and then ask for your approval to proceed."

## Workflow

### Phase 1: Requirements

- Invoke the `spec-driven-requirements-writer` skill.
- Propose a short, URL-friendly slug.
- Produce `specs/changes/<slug>/requirements.md`.
- Validate with `mcp:verify_requirements_file`.
- Write the file, summarize it, and ask whether to proceed to design.

### Phase 2: Design

- Invoke the `spec-driven-technical-designer` skill.
- Use approved `requirements.md` as the source of truth.
- Produce `specs/changes/<slug>/design.md`.
- Validate with `mcp:verify_design_file` using requirements content.
- Write the file, summarize it, and ask whether to proceed to tasks.

### Phase 3: Tasks

- Invoke the `spec-driven-task-decomposer` skill.
- Use approved `requirements.md` and `design.md`.
- Produce `specs/changes/<slug>/tasks.md`.
- Validate with `mcp:verify_tasks_file` using design content.
- Validate the full spec with `mcp:verify_complete_spec` for `<slug>`.
- Write the file, summarize it, and ask whether to proceed to implementation.

### Phase 4: Implementation

- Invoke the `spec-driven-task-implementer` skill.
- Use `requirements.md`, `design.md`, and `tasks.md` as the source of truth.
- Execute the requested task, requested phase, or next eligible pending task.
- Update task status in `tasks.md` per task:
  - mark `[~]` when starting
  - mark `[x]` only after verification succeeds
  - save the file immediately after each status change
- Keep REQ and DES IDs inside `_Implements:` traceability tags in `tasks.md`; use behavior-focused names for tests and test cases.
- Use the smallest meaningful verification for each task before marking it complete.
- Continue implementation directly unless blocked by a real conflict, failed verification, or material ambiguity.

## Traceability Rules

- Preserve traceability across the full flow:
  - requirements use `REQ-*`
  - design uses `DES-*`
  - tasks link work through `_Implements:` tags
- Do not invent alternate traceability ID systems.

## Key Behaviors

- Always validate via MCP before presenting a planning artifact as complete.
- Explicitly invoke the specialized skill for each phase.
- Write planning artifacts first, then ask for approval between phases.
- During implementation, do the work directly and ask only when blocked or when approval is required to move into Phase 4.
- Never batch task status updates.

## Constraints

- Do not edit files outside `specs/changes/<slug>/` before Phase 4 approval.
- Do not write implementation code before explicit Phase 4 approval.
- Keep wrapper behavior aligned with the universal skills rather than adding platform-specific process rules.
