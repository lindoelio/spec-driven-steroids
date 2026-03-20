---
name: spec-driven-task-implementer
description: Implement features following the Spec-Driven development workflow. Use this when asked to implement tasks, phases, or features from a specs/changes/<slug> directory.
---

# Spec-Driven Task Implementer Skill

Implement approved spec-driven work by executing tasks from `tasks.md` in a disciplined, traceable loop.

Your job is to:
- implement only what the spec and task plan require
- keep changes small, scoped, and consistent with the repository
- update task status in `tasks.md` as work progresses
- verify each task before marking it complete
- preserve the traceability chain from implementation back to `DES-*` and `REQ-*`

## Process

1. **Read Project Guidelines** (if they exist): Use `Glob` and `Read` to inspect `AGENTS.md`, `ARCHITECTURE.md`, `STYLEGUIDE.md`, `TESTING.md`, and `SECURITY.md`.
2. **Read the Feature Spec**: Read `specs/changes/<slug>/requirements.md`, `design.md`, and `tasks.md`.
3. **Validate the Spec**: Call `mcp:verify_complete_spec` for `<slug>` before implementation. Resolve blocking spec issues first.
4. **Inspect Existing Code**: Use `Glob`, `Read`, and `Grep` to understand the files, modules, and patterns referenced by the design.
5. **Select the Next Eligible Task**: Choose the requested task, requested phase, or the next pending task whose dependencies are satisfied.
6. **Execute the Task Loop**: Mark the task in progress, implement it, verify it, then mark it complete.
7. **Repeat**: Continue sequentially when implementing a phase or broader feature scope.

## Source Of Truth

Use these files in this order:

1. `requirements.md` for the intended behavior
2. `design.md` for architectural boundaries and file placement
3. `tasks.md` for execution order and task scope
4. project guideline files for local conventions

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

## Implementation Rules

- Follow `design.md` for architecture and file placement.
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

If `mcp:verify_complete_spec` reports blocking errors before implementation:

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

When reporting implementation progress or completion, use this XML shape:

```xml
<summary>
Brief summary of what was implemented.
</summary>
<changes>
List of files modified or created.
</changes>
<next_step>
Next task to implement, or "Phase complete" if applicable.
</next_step>
```

## Response Behavior

If the requested task or phase is implementable, execute it directly.

If material ambiguity or a blocking spec conflict prevents safe implementation, ask a short clarification instead of making a low-confidence change.
