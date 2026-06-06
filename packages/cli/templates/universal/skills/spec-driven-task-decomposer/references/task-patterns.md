# Task Patterns

Use this reference when tasks feel too broad, phases feel uneven, or acceptance-criteria tests need better grouping.

## Atomic Task Pattern

- Good: one focused change with one clear verification target.
- Split the task if the title naturally contains `and` or spans unrelated files.

## Phase Pattern Defaults

1. Foundation or setup
2. Main feature delivery
3. Supporting behavior or publication flow
4. Acceptance Criteria Testing
5. Final Checkpoint

If the design's Code Anatomy coverage is `Representative` or `Initial Discovery Only`, Phase 1 starts with an inventory task before setup or implementation work.

## Requirement-First Coverage Pattern

Add a `## Requirement Implementation Coverage` table before Phase 1:

| Requirement | Implementation Coverage | Task or Rationale |
|-------------|-------------------------|-------------------|
| REQ-1.1 | task | 1.2 |
| REQ-1.2 | existing-behavior | Existing validation already rejects invalid input; test task 3.1 verifies it |
| REQ-2.1 | no-code-change | Documentation-only requirement; covered by task 2.1 |

Use `task` when production behavior changes. Use `existing-behavior`, `test-only`, or `no-code-change` only with a concrete rationale.

## Discovery Task Pattern

Use this as the first implementation task for non-exhaustive Code Anatomy:

```markdown
- [ ] 1.1 Inventory implementation touchpoints
  - Execute the design's `Discovery Targets` and update this task plan if additional in-scope files, entrypoints, exports, tests, or integrations are found.
  - _Implements: DES-1, REQ-1.1_
```

The discovery task is complete only after the agent either amends `tasks.md` for newly discovered in-scope work or records why no amendments were needed.

## Grouped Test Guidance

Group acceptance criteria into one test task only when a single flow naturally proves them together.

- Good grouping: remote-template success plus injected output from the same inject run.
- Bad grouping: wrapper prompt alignment plus workflow publication.

## Parallel-Friendly Decomposition

When decomposing feature-delivery tasks on a platform that supports sub-agent parallelism (e.g., OpenCode), structure tasks to maximize independent work.

### Independence Indicators

A task is ready for parallel execution when:
- All `_Depends:` are satisfied by tasks in an earlier phase or already-completed tasks
- Its file set (`_Implements:` targets) does not overlap with other tasks in the same phase
- It has no cross-dependency with other tasks in its batch

### Structuring for Parallelism

- Keep feature-delivery tasks focused on distinct files or modules
- Avoid coupling tasks through shared infrastructure files (configs, types, schema) unless a dedicated foundation task handles them first
- Push shared setup into an early sequential phase, then parallelize the feature-delivery phase
- Prefer one test file per acceptance criteria test task to avoid file conflicts during parallel test execution

### Example: Sequential vs Parallel-Friendly

**Sequential (poor for parallelism):**
```markdown
- [ ] 2.1 Add denial feedback and audit logging
  - _Implements: DES-1, DES-2
```
Single task touching two independent concerns → no parallelism opportunity.

**Parallel-friendly:**
```markdown
- [ ] 2.1 Add denial feedback path
  - _Depends: 1.3
  - _Implements: DES-1
- [ ] 2.2 Add audit logging
  - _Depends: 1.3
  - _Implements: DES-2
```
Two independent tasks with the same dependency but distinct file sets → parallel batch.

### Annotation

Do NOT add `_Parallel:` annotations in `tasks.md`. The implementer determines parallel batches dynamically from dependency analysis. The decomposer's job is to create independent work units; the implementer decides when parallelism is safe.
