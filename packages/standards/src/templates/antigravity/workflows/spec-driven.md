---
name: Spec Driven
description: Full Spec-Driven flow (Requirements → Design → Tasks → Code).
---

# Spec-Driven Implementation

Follow these steps strictly to ensure high-quality, traceable software engineering.

## Phase Gatekeeper (Non-Bypassable)

You MUST enforce this lifecycle exactly: `requirements -> design -> tasks -> implementation`.

- Never skip phases, even if the user asks to "just implement" or "fix it now".
- If there is no approved `specs/changes/<slug>/requirements.md`, always start at Phase 1.
- Before Phase 4 is explicitly approved by the human, do not write implementation code.
- Before Phase 4 approval, only write files under `specs/changes/<slug>/`.
- Every phase transition requires explicit human approval.

If a user asks for direct implementation before requirements, respond with:

"I can implement this, but per Spec-Driven flow I must start with Phase 1 (requirements) first. I will propose a slug and draft `specs/changes/<slug>/requirements.md` for your approval."

## 0. Setup
- Generate a short slug for the change (e.g., `auth-refactor`).
- All artifacts will be stored in `specs/changes/<slug>/`.

## 1. Requirements (The "Asteroid" impact)
- **Action**: Invoke the `spec-driven-requirements-writer` skill.
- **Goal**: Produce a Markdown requirement using EARS syntax in `specs/changes/<slug>/requirements.md`.
- **Validation**: Call `mcp:verify_requirements_file` to validate sections, numbering, and EARS patterns.
- **Review**: STOP and ask: "Human, does this requirement accurately reflect your intent?"

## 2. Technical Design
- **Action**: Invoke the `spec-driven-technical-designer` skill.
- **Goal**: Create architecture diagrams (Mermaid) and code anatomy in `specs/changes/<slug>/design.md`.
- **Validation**: Call `mcp:verify_design_file` with requirements content to validate diagrams, traceability, and structure.
- **Review**: STOP and ask the human to review the design decisions.

## 3. Atomic Tasks
- **Action**: Invoke the `spec-driven-task-decomposer` skill.
- **Goal**: Break the design into numbered implementation tasks in `specs/changes/<slug>/tasks.md`.
- **Review**: Confirm the task list with the human.

## 4. Implementation
- **Action**: Invoke the `spec-driven-task-implementer` skill.
- **Goal**: Execute tasks one by one as defined in `specs/changes/<slug>/tasks.md`.
- **Status Updates**: After EVERY task, update its status in `tasks.md` (`[ ]` -> `[~]` -> `[x]`).
- **Double Check**: After EVERY task, ensure the implementation aligns with the design and requirements.
- **Evaluation**: After EVERY task, run tests and static analysis to ensure quality.
- **Review**: After EVERY task, present a summary of changes to the human for final approval.
- **Traceability**: Reference the Requirement and Design IDs in every commit message.

## Constraints
- Do not write implementation code before explicit Phase 4 approval.
- Do not edit files outside `specs/changes/<slug>/` before Phase 4 approval.
