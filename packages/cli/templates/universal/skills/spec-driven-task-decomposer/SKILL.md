---
name: spec-driven-task-decomposer
description: Use this skill when approved requirements and design need to be decomposed into tasks.md for Phase 3 of a Spec-Driven change. It creates atomic, traceable implementation and testing tasks, validates the plan, and should not be used to design architecture or write implementation code.
---

# Spec-Driven Task Decomposer Skill

Write a `tasks.md` document that turns approved requirements and design elements into an ordered, traceable implementation plan.

Your job is to produce a task artifact that:
- is easy for an implementation agent to execute in sequence
- keeps tasks small, concrete, and dependency-aware
- preserves traceability from tasks to `DES-*` and `REQ-*`
- includes explicit acceptance-criteria test coverage before final verification

Default path: read approved requirements and design, group work into practical phases, create atomic tasks, add acceptance-criteria testing, validate `tasks.md`, and return a short review-ready summary.

Read `references/task-patterns.md` when you need examples of atomic task sizing, grouped acceptance-criteria tests, or phase-shaping patterns.

## Shared Protocol

Follow the Context Preflight and Phase Gate protocols in the `spec-driven-shared` skill's `references/shared-protocol.md`.

## Per-Phase Todo List

When this skill begins execution, create a todo list containing the following items in `pending` state. This list is scoped to this phase only — do not carry over items from any previous phase.

1. Read requirements.md and design.md
2. Read project guidelines
3. Retrieve contextual memory (workflow)
4. Inspect existing patterns
5. Define implementation phases
6. Create atomic tasks
7. Add acceptance criteria testing phase
8. Add final checkpoint phase
9. Save tasks.md
10. Validate tasks
11. Audit tasks (agent-work-auditor)

### Progress Rules

- Mark an item `in_progress` when starting that work step.
- Mark an item `completed` only after the work step has been verified.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when this phase begins; do not append to a prior phase's list.

## Output File

`.specs/changes/<slug>/tasks.md`

**IMPORTANT:** Only `tasks.md` is a valid spec document name for tasks. The spec-driven workflow strictly requires exactly three document types: `requirements.md`, `design.md`, and `tasks.md`.

## Required Document Structure

See the `spec-driven-shared` skill's `references/document-templates.md` for the tasks document template.

## Task Rules

- Use checkbox task format: `- [ ] N.M Task title`.
- Number phases sequentially as `## Phase 1: ...`, `## Phase 2: ...`, and so on.
- Number tasks sequentially inside each phase using the phase number (`1.1`, `1.2`, `2.1`, etc.).
- Every non-checkpoint task must include an `_Implements:` line.
- Use `_Depends:` only when the dependency is real and useful.
- Resolve all placeholders before returning output.
- Do not include HTML comments, TODO markers, or drafting notes.
- Include `## Repository Constraints` when guidelines, contextual memory, or design evidence affects task ordering, test placement, naming, package boundaries, or verification commands.

## Task Types

### Implementation Tasks

Use implementation tasks for building or modifying design elements:

```markdown
- [ ] 2.1 Add authorization middleware
  - Implement the request guard used by protected endpoints.
  - _Depends: 1.2_
  - _Implements: DES-1, REQ-1.1_
```

Rules:
- Every implementation task must reference at least one `DES-*` element.
- Add `REQ-*` references when the task clearly delivers a specific requirement behavior.
- Keep titles action-oriented: `Add`, `Update`, `Refactor`, `Wire`, `Create`, `Remove`.

### Test Tasks

Use test tasks in the dedicated `Acceptance Criteria Testing` phase:

```markdown
- [ ] 3.1 Test: reject unauthorized access
  - Verify requests without the required role are rejected.
  - Test type: integration
  - _Depends: 2.1_
  - _Implements: REQ-1.1_
```

Rules:
- Prefix test tasks with `Test:`.
- Use behavior-focused titles; do not include `REQ-*` IDs in the title.
- Every test task must include `Test type: unit`, `Test type: integration`, or `Test type: e2e`.
- Every test task must include `_Implements:` with one or more `REQ-*` acceptance criteria.
- Every acceptance criterion from `requirements.md` must be covered by at least one test task.
- Group closely related acceptance criteria into one test task when a single test flow naturally verifies them together.

## Testing Guidance

Choose test type in this order:
1. Follow `TESTING.md` if present
2. Follow the design document's `Testing Requirements` section if present
3. Otherwise default by scope:
   - `unit` for isolated logic
   - `integration` for cross-component or service-boundary behavior
   - `e2e` for user-visible end-to-end flows

The `Acceptance Criteria Testing` phase must be the penultimate phase. The `Final Checkpoint` phase must be the last phase.

## Phase Design Guidance

Use phases to create a practical execution order. Good phase patterns include:
- foundation or setup
- core feature delivery
- supporting integrations or error handling
- acceptance criteria testing
- final checkpoint

Prefer 3-6 phases for most changes.

## Sizing and Dependency Rules

- Prefer tasks that fit within one focused session.
- Split tasks that cover multiple unrelated concerns.
- Split tasks that touch too many files or systems without a clear reason.
- Avoid dependency chains longer than necessary.
- If a task title naturally contains `and`, consider splitting it.

## Traceability Rules

- Every `DES-*` element from `design.md` should be implemented by at least one implementation task.
- Every `REQ-*` acceptance criterion from `requirements.md` must be covered by at least one test task.
- Use `_Implements: DES-X_` or `_Implements: DES-X, REQ-Y.Z_` for implementation tasks.
- Use `_Implements: REQ-Y.Z_` or grouped `_Implements: REQ-Y.Z, REQ-A.B_` for test tasks.
- Use `_Implements: All requirements_` only for the Final Checkpoint task.

## Clarification Policy

Ask a clarifying question only if the ambiguity would materially change task sequencing, dependency structure, test strategy, or how requirements map to design elements.

### When to Ask
- The design is missing key `DES-*` details needed for decomposition
- The requirements and design appear inconsistent
- Scope is too broad for one coherent task plan

### When NOT to Ask
- Design provides enough structure for a reasonable task breakdown
- Low-risk assumption can be made and reflected in the tasks

## Validation and Recovery

When `sds validate tasks` or `sds validate spec` returns errors:
1. Add missing required sections or phases
2. Fix task numbering and checkbox formatting
3. Add missing `_Implements:` lines to non-checkpoint tasks
4. Add or fix `DES-*` references so they match `design.md`
5. Add or fix test tasks so every acceptance criterion is covered

After 3 failed validation attempts:
1. Summarize remaining errors
2. Ask: "Should I proceed with best-effort corrections?"

### Incomplete Design or Requirement Inputs

If `requirements.md` or `design.md` is incomplete but still usable:
1. Preserve valid traceability that already exists
2. Infer the smallest reasonable task plan from available structure
3. Avoid inventing major new architecture

## Auditing Integration

After completing tasks and before requesting approval, invoke the `agent-work-auditor` skill:

```
Invoke: agent-work-auditor skill
Artifact: .specs/changes/<slug>/tasks.md
ChangeType: feat
Mode: standard
Extensions: spec-driven
```

The audit verdict (Approve / Request Changes / Approval with Notes) determines whether to proceed to Phase 4.

## Quality Bar (Self-Check)

Before returning the tasks, verify:
- [ ] Document starts with `# Implementation Tasks`
- [ ] `## Overview` is present
- [ ] Phase headers use `## Phase N: Title`
- [ ] `Acceptance Criteria Testing` is the penultimate phase
- [ ] `Final Checkpoint` is the last phase
- [ ] Every task uses checkbox format
- [ ] Every non-checkpoint task includes `_Implements:`
- [ ] Every `DES-*` from `design.md` is covered by implementation tasks
- [ ] Every `REQ-*` acceptance criterion is covered by at least one test task
- [ ] No HTML comments or drafting notes remain

## Output Requirements

Write `.specs/changes/<slug>/tasks.md` before requesting review. Prefer validator-compatible structure over decorative formatting. Keep the plan concise but complete enough for direct implementation.

## Response Behavior

If enough information is available, produce the full `tasks.md` content directly.

If material ambiguity blocks a sound task plan, ask a short clarification first. Do not produce a low-confidence decomposition.

## Contextual Stewardship Integration

At the start of this phase, invoke the `contextual-stewardship` skill to retrieve established workflow conventions:

```text
Invoke: contextual-stewardship skill
Action: retrieve
Query: workflow
```

## Things To Avoid

- Creating additional files in `.specs/changes/<slug>/`. Only write tasks.md for this phase.
