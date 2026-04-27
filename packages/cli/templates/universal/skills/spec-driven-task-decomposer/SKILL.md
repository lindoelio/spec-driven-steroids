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

## Process

If `long-running-work-planning` is available, load it at the start of this phase before decomposing the work. Use it to shape execution-safe tasks, checkpoint progress, and ensure the resulting `tasks.md` can drive resumable autonomous implementation.

1. **Read Requirements**: Read `.specs/changes/<slug>/requirements.md`.
2. **Read Design**: Read `.specs/changes/<slug>/design.md`.
3. **Read Project Guidelines** (if they exist): Use `Glob` and `Read` to inspect `TESTING.md` and `STYLEGUIDE.md`.
4. **Retrieve Contextual Memory**: Invoke the `contextual-stewardship` skill in `retrieve` or `inject tasks` mode to retrieve `workflow` and `team-structure` rules.
5. **Inspect Existing Patterns**: Use `Grep` to find similar task structures in existing specs when planning comparable work; context budget is requirements, design, testing guidance, repository context evidence, and targeted examples only.
6. **Define Phases**: Group work into a small number of phases that follow implementation dependencies.
7. **Create Atomic Tasks**: Break each design element into tasks that are concrete and usually completable within one focused session.
8. **Add Acceptance Criteria Testing**: Create a dedicated penultimate testing phase covering every acceptance criterion.
9. **Add Final Checkpoint**: Create a final phase that verifies all requirements and overall spec completeness.
10. **Write Before Validation**: Save to `.specs/changes/<slug>/tasks.md` before validating.
11. **Validate Tasks**: Run `sds validate tasks .specs/changes/<slug>/tasks.md` against the written file.
12. **Validate Full Spec**: Run `sds validate spec <slug>`, fix failures in the written file, and re-run validation before asking for approval.

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

**IMPORTANT:** Only `tasks.md` is a valid spec document name for tasks. Do NOT create `implementation.md`, `plan.md`, `spec.md`, or any other document name. The spec-driven workflow strictly requires exactly three document types: `requirements.md`, `design.md`, and `tasks.md`.

## CLI Validation Discovery

After writing the tasks file, validate it using the CLI. Do not claim validation passed unless these commands were actually run and their output was observed:

```bash
sds validate tasks .specs/changes/<slug>/tasks.md --design .specs/changes/<slug>/design.md --requirements .specs/changes/<slug>/requirements.md
sds validate spec <slug>
```

Examples:
```bash
sds validate tasks .specs/changes/my-feature/tasks.md --design .specs/changes/my-feature/design.md --requirements .specs/changes/my-feature/requirements.md
sds validate spec my-feature
```

**Note:** Both `sds` and `spec-driven-steroids` work interchangeably as the CLI command name.

## Required Document Structure

Your output must use this structure.

```markdown
# Implementation Tasks

## Overview

This implementation is organized into 4 phases:

1. **Foundation** - Prepare core structures and entry points
2. **Feature Delivery** - Implement the main design elements
3. **Acceptance Criteria Testing** - Verify requirement behavior
4. **Final Checkpoint** - Validate completeness and readiness

**Estimated Effort**: Medium (3-5 sessions)

## Repository Constraints

- Follow `TESTING.md` for test placement and command selection.
- Follow `STYLEGUIDE.md` and the design document's `Repository Context Evidence` for naming, file placement, and package boundaries.
- Apply contextual-stewardship workflow rules retrieved for this phase.

## Phase 1: Foundation

- [ ] 1.1 Add request entry point
  - Create the main request handler for protected operations.
  - _Implements: DES-1_

- [ ] 1.2 Add authorization service
  - Implement the shared authorization decision logic used by protected operations.
  - _Depends: 1.1_
  - _Implements: DES-1, REQ-1.1, REQ-1.2_

## Phase 2: Feature Delivery

- [ ] 2.1 Add denial feedback path
  - Return a user-visible denial response when authorization fails.
  - _Depends: 1.2_
  - _Implements: DES-1, REQ-2.1_

- [ ] 2.2 Add audit logging for denied actions
  - Record authorization failures when audit logging is enabled.
  - _Depends: 1.2_
  - _Implements: DES-2, REQ-3.1, REQ-3.2_

## Phase 3: Acceptance Criteria Testing

- [ ] 3.1 Test: reject non-administrator protected actions
  - Verify protected actions are rejected for non-administrator users.
  - Test type: integration
  - _Depends: 1.2_
  - _Implements: REQ-1.1_

- [ ] 3.2 Test: allow administrator protected actions
  - Verify protected actions succeed for administrator users.
  - Test type: integration
  - _Depends: 1.2_
  - _Implements: REQ-1.2_

- [ ] 3.3 Test: show denial feedback and record denied attempts
  - Verify denied protected actions display the denial response and record the denial event.
  - Test type: integration
  - _Depends: 2.1, 2.2_
  - _Implements: REQ-2.1, REQ-3.1_

## Phase 4: Final Checkpoint

- [ ] 4.1 Verify all acceptance criteria
  - REQ-1: Confirm protected actions enforce authentication and administrator authorization.
  - REQ-2: Confirm denied access returns clear feedback.
  - REQ-3: Confirm denied actions are recorded when logging is enabled.
  - Run the relevant test suite and resolve any remaining traceability gaps.
  - _Implements: All requirements_
```

## Task Rules

- Use checkbox task format: `- [ ] N.M Task title`.
- Number phases sequentially as `## Phase 1: ...`, `## Phase 2: ...`, and so on.
- Number tasks sequentially inside each phase using the phase number (`1.1`, `1.2`, `2.1`, etc.).
- Every non-checkpoint task must include an `_Implements:` line.
- Use `_Depends:` only when the dependency is real and useful.
- Resolve all placeholders before returning output.
- Do not include HTML comments, TODO markers, or drafting notes in the final artifact.
- Include `## Repository Constraints` when guidelines, contextual memory, or design evidence affects task ordering, test placement, naming, package boundaries, or verification commands.

## Task Types

### Implementation Tasks

Use implementation tasks for building or modifying design elements.

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

Use test tasks in the dedicated `Acceptance Criteria Testing` phase.

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
- You may group closely related acceptance criteria into one test task when a single test flow naturally verifies them together.
- If multiple criteria are grouped, the title and description must make the combined behavior explicit.

## Testing Guidance

Choose test type in this order:

1. Follow `TESTING.md` if present.
2. Follow the design document's `Testing Requirements` section if present.
3. Otherwise default by scope:
   - `unit` for isolated logic
   - `integration` for cross-component or service-boundary behavior
   - `e2e` for user-visible end-to-end flows

The `Acceptance Criteria Testing` phase must be the penultimate phase.

The `Final Checkpoint` phase must be the last phase.

## Phase Design Guidance

Use phases to create a practical execution order.

Good phase patterns include:

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
- If one task depends on many earlier tasks, reconsider the phase layout.

## Traceability Rules

- Every `DES-*` element from `design.md` should be implemented by at least one implementation task.
- Every `REQ-*` acceptance criterion from `requirements.md` must be covered by at least one test task.
- Use `_Implements: DES-X_` or `_Implements: DES-X, REQ-Y.Z_` for implementation tasks.
- Use `_Implements: REQ-Y.Z_` or grouped `_Implements: REQ-Y.Z, REQ-A.B_` for test tasks.
- Use `_Implements: All requirements_` only for the Final Checkpoint task.

## Clarification Policy

Ask a clarifying question only if the ambiguity would materially change:

- task sequencing
- dependency structure
- test strategy
- how requirements map to design elements

### When to Ask

- The design is missing key `DES-*` details needed for decomposition.
- The requirements and design appear inconsistent.
- The scope is too broad for one coherent task plan.
- Test coverage expectations are materially unclear.

### When NOT to Ask

- The design provides enough structure for a reasonable task breakdown.
- A low-risk assumption can be made and reflected in the tasks.
- The ambiguity is implementation-level rather than decomposition-level.

### How to Ask

- Ask no more than 3 focused questions at a time.
- Ask about execution decisions, not implementation preferences.
- Prefer concrete options when possible.

## Validation and Recovery

### CLI Validation Failures

When `sds validate tasks` or `sds validate spec` returns errors:

1. Add missing required sections or phases.
2. Fix task numbering and checkbox formatting.
3. Add missing `_Implements:` lines to non-checkpoint tasks.
4. Add or fix `DES-*` references so they match `design.md`.
5. Add or fix test tasks so every acceptance criterion is covered.
6. Reorder tasks to remove obvious dependency issues.

After 3 failed validation attempts:

1. Summarize the remaining errors.
2. Ask: "Should I proceed with best-effort corrections?"
3. If yes: make corrections and document assumptions in ordinary task prose.
4. If no: request focused guidance.

### Incomplete Design or Requirement Inputs

If `requirements.md` or `design.md` is incomplete but still usable:

1. Preserve valid traceability that already exists.
2. Infer the smallest reasonable task plan from available structure.
3. Avoid inventing major new architecture.
4. Surface the blocking gaps if they prevent reliable decomposition.

## Auditing Integration

After completing tasks and before requesting approval, invoke the `agent-work-auditor` skill to perform a unified audit:

```
Invoke: agent-work-auditor skill
Artifact: .specs/changes/<slug>/tasks.md
ChangeType: feat
Mode: standard
Extensions: spec-driven
```

The `agent-work-auditor` provides a three-layer audit:

### Layer 1: Core Dimensions (Always Evaluated)

| Dimension | Focus | Auto-Fix |
|-----------|-------|----------|
| Completeness | All DES-* elements have tasks? | Yes |
| Correctness | Valid task structure, checkbox format? | Yes |
| Consistency | Consistent with existing patterns? | Yes |
| Traceability | TASK → DES-* → REQ-* links complete? | Partial |
| Safety | No harmful side effects in tasks? | No |
| Maintainability | Clear and actionable tasks? | Partial |

### Layer 2: Change-Type Module

Based on classified change type:
- Applies appropriate rigor for task breakdown depth

### Layer 3: Spec-Driven Extension

- **Rigorous Against Prompt/Spec**: Verifies tasks align with approved requirements and design
- **Traceability Matrix**: Confirms all DES-* and REQ-* are covered
- **Phase Gate Verification**: Confirms design phase passed before tasks approval

### Composition: quality-grading (Originality Dimension)

The agent-work-auditor internally composes `quality-grading` for the **Originality** dimension:
- **Originality**: Tailored task breakdown vs generic boilerplate

This composition ensures comprehensive quality assessment without requiring separate skill invocation.

### Self-Fix Loop

agent-work-auditor will:
1. Auto-fix direct-fix findings (up to 3 passes)
2. Escalate remaining issues to author-required
3. Output a structured audit report with verdict

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
- [ ] Grouped test tasks only combine naturally related criteria
- [ ] Numbering is concrete; no symbolic placeholders like `N-1` remain
- [ ] No HTML comments or drafting notes remain

## Output Requirements

- Write `.specs/changes/<slug>/tasks.md` before requesting review
- Prefer validator-compatible structure over decorative formatting
- Keep the plan concise but complete enough for direct implementation
- Return ordinary prose summary after the file is written; do not wrap the artifact in XML

## Response Behavior

If enough information is available, produce the full `tasks.md` content directly.

If material ambiguity blocks a sound task plan, ask a short clarification first. Do not produce a low-confidence decomposition.

## Contextual Stewardship Integration

At the start of this phase, before decomposing the work, invoke the `contextual-stewardship` skill to retrieve established workflow conventions:

```text
Invoke: contextual-stewardship skill
Action: retrieve
Query: workflow
```

This ensures the task breakdown aligns with team processes, testing rules, and naming conventions.
