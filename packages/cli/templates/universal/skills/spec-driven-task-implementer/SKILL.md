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

## Process

1. **Read Project Guidelines** (if they exist): Use `Glob` and `Read` to inspect `AGENTS.md`, `ARCHITECTURE.md`, `STYLEGUIDE.md`, `TESTING.md`, and `SECURITY.md`.
2. **Read the Feature Spec**: Read `.specs/changes/<slug>/requirements.md`, `design.md`, and `tasks.md`.
3. **Retrieve Contextual Memory**: Invoke the `contextual-stewardship` skill in `retrieve` or `inject implementation` mode to retrieve `architecture`, `business`, and `workflow` rules.
4. **Validate the Spec**: Run `sds validate spec <slug>` before implementation. Resolve blocking spec issues first.
5. **Inspect Existing Code**: Use `Glob`, `Read`, and `Grep` to understand the files, modules, and patterns referenced by the active task. Context budget: load only the active task block, linked REQ/DES sections, repository context evidence, and relevant code files.
6. **Select the Next Eligible Task**: Choose the requested task, requested phase, or the next pending task whose dependencies are satisfied.
7. **Execute the Task Loop**: Mark the task in progress, implement it, verify it, then mark it complete.
8. **Repeat**: Continue sequentially only when implementing an explicitly requested phase or broader feature scope.

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

`tasks.md` is the progress ledger and must stay accurate.

Use these checkbox states:

- `- [ ]` pending
- `- [~]` in progress
- `- [x]` completed

### Hard Rule

Update `tasks.md` immediately when a task changes state.

- Mark a task `- [~]` before you begin implementation.
- Mark a task `- [x]` only after implementation and verification succeed.
- Do not batch status updates at the end of a phase or session.

## Execution Loop

For each task:

1. Find the target task in `tasks.md`.
2. Confirm it is pending and all `_Depends:` tasks are complete.
3. Change the task to `- [~]` and save `tasks.md`.
4. Implement only the scoped behavior required by the task.
5. Run the smallest meaningful verification for the change.
6. If verification passes, change the task to `- [x]` and save `tasks.md`.
7. If verification fails, keep the task in progress until the issue is fixed or escalated.

## Task Selection Rules

### Implementing a Specific Task

- Implement only that task unless a required dependency must be finished first.
- Do not opportunistically work ahead on unrelated tasks.

### Implementing a Phase

- Execute pending tasks in that phase in dependency order.
- Complete one task fully before starting the next.

### Implementing a Whole Feature

- Start with the earliest pending task whose dependencies are satisfied.
- Continue phase by phase.

### Default Scope

- Implement one task by default.
- Do not continue to the next task unless the user explicitly requested a phase or full feature.

## Implementation Rules

- Follow `design.md` for architecture and file placement.
- Follow `design.md` `Repository Context Evidence` when choosing files, names, abstractions, and boundaries.
- Follow `STYLEGUIDE.md` and surrounding code for naming, structure, and patterns.
- Prefer the strongest local convention that is both current and consistent with repository guidance.
- Keep changes minimal and scoped to the active task.
- Do not add features that are not required by the spec.
- Do not refactor unrelated code while implementing the task.
- Respect package and module boundaries.
- Preserve existing error handling expectations unless the task explicitly changes them.

## Test Task Rules

Tasks in the `Acceptance Criteria Testing` phase, or tasks prefixed with `Test:`, should create or update tests rather than production behavior.

### Test Naming

- Remove the `Test:` prefix when writing actual test names.
- Use pure behavior descriptions in test titles.
- Do not include `REQ-*` or `DES-*` IDs in test names.
- Do not include `REQ-*` or `DES-*` IDs in code comments.

Good:

```typescript
it('rejects invalid email addresses', async () => {
  // test body
})
```

Bad:

```typescript
it('Test: rejects invalid email addresses // REQ-2.1', async () => {
  // test body
})
```

### Test Execution

- Follow `TESTING.md` for file placement, tools, and conventions.
- Use the test type specified by the task when present.
- If a test task reveals a defect in existing implementation, fix the implementation before marking the test task complete.

## Verification Rules

Before marking any task `- [x]`, verify all of the following:

- the implementation matches the task description
- the implementation still matches the linked requirements and design intent
- relevant tests pass
- no new failures were introduced in the touched scope
- no new obvious lint or type issues were introduced by the change

Use the smallest meaningful verification first:

- targeted unit or integration tests for local changes
- file- or package-scoped checks when available
- broader validation only when the task impact justifies it

## Documentation Maintenance

Update user-facing documentation when the task changes:

- public behavior
- CLI commands or flags
- configuration or setup steps
- user workflows that the README or docs already describe

Do not update docs for purely internal refactors unless usage actually changes.

## Conflict Policy

Stop and surface the issue if:

- `requirements.md`, `design.md`, and `tasks.md` disagree materially
- the design does not fit the codebase reality in a safe way
- a task requires a breaking change not described in the spec
- an implementation path would weaken security, privacy, or safety expectations

When a conflict appears:

1. Do not mark the task complete.
2. Summarize the conflict clearly.
3. Propose the smallest reasonable resolution.
4. Ask for clarification only if you cannot safely proceed.

## Recovery Rules

### Spec Validation Failures

If `sds validate spec` reports blocking errors before implementation:

1. Do not start coding yet.
2. Identify whether the issue is in requirements, design, or tasks.
3. Resolve the spec issue first or ask for guidance if the issue is ambiguous.

### Test Failures During Implementation

If verification fails:

1. Keep the current task at `- [~]`.
2. Fix the implementation or test as appropriate.
3. Re-run the relevant verification.
4. Escalate only if the failure indicates a real spec or design problem.

### Interrupted Sessions

If work resumes after interruption:

1. Read `tasks.md` first.
2. Locate any `- [~]` task.
3. Verify the code and file state for that task.
4. Resume that task before starting new work.

## Things To Avoid

- adding HTML comments such as `<!-- TBD -->`, `<!-- KNOWN ISSUE -->`, or `<!-- FAILED -->`
- adding scope that is not requested
- silently diverging from the design
- marking tasks complete without verification
- batching multiple task status updates after the fact
- introducing secrets or sensitive data into the repository
- creating additional files in `.specs/changes/<slug>/`. Only write to tasks.md for status updates.

## Quality Bar (Self-Check)

Before marking a task complete or reporting progress, verify:

- [ ] active task status in `tasks.md` is accurate
- [ ] task dependencies were satisfied before starting
- [ ] changes are scoped to the active task
- [ ] implementation matches requirements and design intent
- [ ] relevant verification was run and passed
- [ ] no task-state updates were skipped
- [ ] no HTML comments or drafting markers were introduced

## Output Requirements

When reporting implementation progress or completion:

- summarize the work in ordinary prose
- list the key files changed
- identify the next eligible task or state that the phase is complete

## Response Behavior

If the requested task or phase is implementable, execute it directly.

If material ambiguity or a blocking spec conflict prevents safe implementation, ask a short clarification instead of making a low-confidence change.

## Phase 5: Unified Auditing (agent-work-auditor)

After all Phase 4 implementation tasks are complete, invoke the `agent-work-auditor` skill to perform a unified audit on the implementation:

```
Invoke: agent-work-auditor skill
Artifact: <implementation-directory-or-files>
ChangeType: <detected-from-branch-commit-context>
Mode: standard
Extensions: spec-driven
```

### Step 1: Detect Change Type

Infer from branch name, commit messages, or task context. If unclear, fall back to `General` review.

### Step 2: Invoke agent-work-auditor

The `agent-work-auditor` provides a three-layer audit:

#### Layer 1: Core Dimensions (Always Evaluated)

| Dimension | Focus | Auto-Fix |
|-----------|-------|----------|
| Completeness | All required elements present? | Yes |
| Correctness | Implementation matches spec? | Yes |
| Consistency | Consistent with codebase patterns? | Yes |
| Traceability | Implementation traces to DES-*/REQ-*? | Partial |
| Safety | No harmful side effects? | No |
| Maintainability | Clear and maintainable code? | Partial |

#### Layer 2: Change-Type Module

Based on detected change type:
- `feat` → Thorough design and scalability review
- `fix` → Focused bug reproduction and verification
- `hotfix` → Compressed scope minimization and correctness
- `refactor` → Rigorous behavioral parity
- `migrate` → Cautious backward compatibility and schema review
- `docs` → Lightweight accuracy review
- `general` → Balanced review across dimensions

#### Layer 3: Spec-Driven Extension

- **Rigorous Against Prompt/Spec**: Verifies implementation aligns with approved requirements, design, and tasks
- **Traceability Matrix**: Confirms all DES-* and REQ-* are implemented
- **Phase Gate Verification**: Confirms all prior phases passed

### Step 3: Composition with quality-grading (Originality Dimension)

The agent-work-auditor internally composes `quality-grading` for the **Originality** dimension:
- **Originality**: Problem-specific solutions vs generic boilerplate

This composition ensures comprehensive quality assessment without requiring separate skill invocation.

### Step 4: Self-Fix Loop

agent-work-auditor will:
1. Auto-fix direct-fix findings (up to 3 passes)
2. Escalate remaining issues to author-required
3. Output a structured audit report with verdict

### Step 5: Record Verdict

- If verdict is `Approve` or `Approval with Notes`, proceed to Live Check
- If `Request Changes`, flag findings but still proceed to Live Check
- Report findings in the response. Do not create new tasks for author-required findings.

**Do not block on author-required findings.** Findings are author-resolution items. The spec-driven workflow continues to Live Check regardless of audit verdict.

## Live Check Integration (Final Pre-Flight Validation)

After completing Phase 5 (Unified Auditing) but before the implementation is considered complete:

1. **Invoke universal-live-check**: Run a final live validation pass on the files changed in Phase 4.
2. **Detect domains**: Classify affected domains from file paths (CLI, backend, frontend, mobile, embedded, libs).
3. **Detect change type**: Infer from branch name, commit messages, or task context.
4. **Execute checks**: Run hierarchical validation (file → module → project) with incremental checks.
5. **Self-healing loop**: Attempt auto-fix for fixable issues, re-verify, then report remaining findings.

```
Invoke: universal-live-check skill
Input:  Files/directories changed in Phase 4, change type
Output: Structured check report with pass/fail per check category
```

The universal-live-check skill will:
- Classify domains affected by the change (CLI, backend, frontend, mobile, embedded, libs)
- Detect cross-domain contamination (e.g., libs changes affecting backend consumers)
- Run domain-specific checks with change-type-aware strategies (feat needs full validation, hotfix needs minimal blocking)
- Execute hierarchical validation: file-level (~10ms) → module-level (~100ms) → project-level (~1s)
- Perform self-healing loop: attempt fix, re-run check, report unfixable issues

**Performance target:** Full live check run completes in <5s. If exceeded, abort and report partial results.

**Note:** Live Check is a separate final validation step. The audit verdict from agent-work-auditor already incorporates quality-grading for Originality. Live Check provides domain-specific validation (linting, typing, testing) that complements the audit.
