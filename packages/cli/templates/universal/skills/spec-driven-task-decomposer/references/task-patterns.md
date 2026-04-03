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

## Grouped Test Guidance

Group acceptance criteria into one test task only when a single flow naturally proves them together.

- Good grouping: remote-template success plus injected output from the same inject run.
- Bad grouping: wrapper prompt alignment plus workflow publication.
