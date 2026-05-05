---
name: spec-driven-task-implementer
description: Use this skill when an approved Spec-Driven change has reached Phase 4 and the user wants a task, phase, or full feature implemented from .specs/changes/<slug>. It executes tasks in order, updates task status immediately, verifies each task before completion, and should not be used before implementation approval.
---

# Spec-Driven Task Implementer Skill

Implement approved spec-driven work by executing tasks from `tasks.md` in a disciplined, traceable loop.

Your job is to:
- implement only what the spec and task plan require
- keep changes small, scoped, and consistent with the repository
- update task status in `tasks.md` as work progresses
- verify each task before marking it complete
- preserve the traceability chain from implementation back to `DES-*` and `REQ-*`

Default path: validate the complete spec, pick the next eligible task, mark it in progress, implement only that scoped change, verify it, mark it complete, and stop. Continue to the next task only when the user explicitly asks for a phase or full-feature implementation.

Read `references/task-execution-patterns.md` when you need examples for resuming interrupted work, choosing the smallest meaningful verification, or handling failed verification loops.

## Shared Protocol

Follow the Context Preflight and Phase Gate protocols in the `spec-driven-shared` skill's `references/shared-protocol.md`.

## Per-Phase Todo List

When this skill begins execution, create a todo list derived from the pending tasks in the approved `tasks.md` for the target slug. Each pending task becomes a todo item. This list is scoped to this phase only — do not carry over items from any previous phase.

### Item Derivation

- Read the approved `tasks.md` for the target slug.
- For each task that is `- [ ]` (pending), create a corresponding todo item.
- Skip tasks that are already `- [x]` (completed) or `- [~]` (in progress).

### Progress Rules

- Mark an item `in_progress` when starting that task.
- Mark an item `completed` only after the task has been verified and marked `- [x]` in `tasks.md`.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when this phase begins; do not append to a prior phase's list.

## Source Of Truth

Use these files in this order:
1. `requirements.md` for the intended behavior
2. `design.md` for architectural boundaries and file placement
3. `tasks.md` for execution order and task scope
4. project guideline files for local conventions
5. contextual-stewardship rules for active project decisions

If these inputs conflict, stop and resolve the conflict before continuing.

## Task Status Rules

`tasks.md` is the progress ledger and must stay accurate. Use checkbox states:
- `- [ ]` pending
- `- [~]` in progress
- `- [x]` completed

### Hard Rule

Update `tasks.md` immediately when a task changes state. Mark `- [~]` before implementation, `- [x]` only after verification succeeds. Do not batch status updates.

## Execution Loop

For each task:
1. Find the target task in `tasks.md`
2. Confirm it is pending and all `_Depends:` tasks are complete
3. Change the task to `- [~]` and save `tasks.md`
4. Implement only the scoped behavior required by the task
5. Run the smallest meaningful verification
6. If verification passes, change the task to `- [x]` and save `tasks.md`
7. If verification fails, keep the task in progress until the issue is fixed or escalated

## Task Selection Rules

### Implementing a Specific Task
- Implement only that task unless a required dependency must be finished first
- Do not opportunistically work ahead on unrelated tasks

### Implementing a Phase
- Execute pending tasks in that phase in dependency order
- Complete one task fully before starting the next

### Default Scope
- Implement one task by default
- Do not continue to the next task unless the user explicitly requested a phase or full feature

## Implementation Rules

- Follow `design.md` for architecture and file placement
- Follow `STYLEGUIDE.md` and surrounding code for naming, structure, and patterns
- Keep changes minimal and scoped to the active task
- Do not add features that are not required by the spec
- Do not refactor unrelated code while implementing the task
- Respect package and module boundaries

## Test Task Rules

Tasks in `Acceptance Criteria Testing` phase or prefixed with `Test:` should create or update tests rather than production behavior.

### Test Naming
- Remove the `Test:` prefix when writing actual test names
- Use pure behavior descriptions in test titles
- Do not include `REQ-*` or `DES-*` IDs in test names or code comments

Good: `it('rejects invalid email addresses', async () => { ... })`

Bad: `it('Test: rejects invalid email addresses // REQ-2.1', async () => { ... })`

## Verification Rules

Before marking any task `- [x]`, verify:
- the implementation matches the task description
- the implementation still matches the linked requirements and design intent
- relevant tests pass
- no new failures were introduced in the touched scope

Use the smallest meaningful verification first.

## Conflict Policy

Stop and surface the issue if:
- `requirements.md`, `design.md`, and `tasks.md` disagree materially
- the design does not fit the codebase reality in a safe way
- a task requires a breaking change not described in the spec

When a conflict appears:
1. Do not mark the task complete
2. Summarize the conflict clearly
3. Propose the smallest reasonable resolution
4. Ask for clarification only if you cannot safely proceed

## Recovery Rules

### Interrupted Sessions
If work resumes after interruption:
1. Read `tasks.md` first
2. Locate any `- [~]` task
3. Verify the code and file state for that task
4. Resume that task before starting new work

### Test Failures During Implementation
If verification fails:
1. Keep the current task at `- [~]`
2. Fix the implementation or test as appropriate
3. Re-run the relevant verification

## Things To Avoid

- adding HTML comments such as `<!-- TBD -->`, `<!-- KNOWN ISSUE -->`
- adding scope that is not requested
- silently diverging from the design
- marking tasks complete without verification
- batching multiple task status updates after the fact
- creating additional files in `.specs/changes/<slug>/`. Only write to tasks.md for status updates

## Quality Bar (Self-Check)

Before marking a task complete, verify:
- [ ] active task status in `tasks.md` is accurate
- [ ] task dependencies were satisfied before starting
- [ ] changes are scoped to the active task
- [ ] implementation matches requirements and design intent
- [ ] relevant verification was run and passed

## Response Behavior

If the requested task or phase is implementable, execute it directly.

If material ambiguity or a blocking spec conflict prevents safe implementation, ask a short clarification instead.

## Phase 5: Unified Auditing

After all Phase 4 implementation tasks are complete, invoke the `agent-work-auditor` skill:

```
Invoke: agent-work-auditor skill
Artifact: <implementation-directory-or-files>
ChangeType: <detected-from-branch-commit-context>
Mode: standard
Extensions: spec-driven
```

### Layer 1: Core Dimensions

| Dimension | Focus | Auto-Fix |
|-----------|-------|----------|
| Completeness | All required elements present? | Yes |
| Correctness | Implementation matches spec? | Yes |
| Consistency | Consistent with codebase patterns? | Yes |
| Traceability | Implementation traces to DES-*/REQ-*? | Partial |
| Safety | No harmful side effects? | No |

### Layer 2: Change-Type Module

- `feat` → Thorough design and scalability review
- `fix` → Focused bug reproduction and verification
- `hotfix` → Compressed scope minimization and correctness
- `refactor` → Rigorous behavioral parity
- `general` → Balanced review across dimensions

### Layer 3: Spec-Driven Extension

- **Rigorous Against Prompt/Spec**: Verifies implementation aligns with approved requirements, design, and tasks
- **Traceability Matrix**: Confirms all DES-* and REQ-* are implemented
- **Phase Gate Verification**: Confirms all prior phases passed

### Record Verdict

- If verdict is `Approve` or `Approval with Notes`, proceed to Live Check
- If `Request Changes`, flag findings but still proceed to Live Check
- Do not block on author-required findings

## Live Check Integration

After completing Phase 5 (Unified Auditing):

1. **Invoke universal-live-check**: Run a final live validation pass on the files changed in Phase 4
2. **Detect domains**: Classify affected domains from file paths
3. **Execute checks**: Run hierarchical validation (file → module → project)
4. **Self-healing loop**: Attempt auto-fix for fixable issues, re-verify, report remaining

```
Invoke: universal-live-check skill
Input: Files/directories changed in Phase 4, change type
Output: Structured check report with pass/fail per check category
```

The universal-live-check skill will classify affected domains, detect cross-domain contamination, run domain-specific checks, execute hierarchical validation, and perform self-healing loop.

**Performance target:** Full live check run completes in <5s. If exceeded, abort and report partial results.
