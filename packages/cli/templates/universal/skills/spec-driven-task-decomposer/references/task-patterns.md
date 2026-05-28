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
