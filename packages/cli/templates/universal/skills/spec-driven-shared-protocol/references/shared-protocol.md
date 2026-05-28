# Shared Protocols

This file contains shared protocols referenced by all phase skills. These protocols define the common workflow steps, quality gates, and validation rules shared across phases.

## Context Preflight Protocol

Before invoking the phase-specific skill, you MUST collect and pass repository context:

1. **Read Project Guidelines** (if they exist):
   - Use `Glob` to find `AGENTS.md`, `STYLEGUIDE.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY.md`
   - Use `Read` to understand existing patterns, naming conventions, and architecture
   - Context budget: do not perform broad code searches unless the request requires repository-specific behavior

2. **Retrieve Contextual Memory**: Invoke the `contextual-stewardship` skill in `retrieve` or `inject <phase>` mode to retrieve relevant rules.

3. **Inspect Existing Code Patterns**: For design and implementation phases, use `Glob`, `Grep`, and `Read` to understand targeted existing code patterns before proposing file placement, abstractions, naming, or tests.

## Phase Gate Behavior

### Non-Skippable Stop Rule

- In a single user turn, you may complete at most one planning phase.
- After finishing Phase 1, Phase 2, or Phase 3, you MUST stop in the same response after summarizing the artifact and asking for approval.
- Do not start the next phase in the same response, even if you believe the user probably wants you to continue.
- Treat approval as explicit only when the user clearly says to proceed, continue, or approve the next phase.
- If approval is missing or ambiguous, stop and wait.

### Verdict Declaration

After completing the Unified Quality Gate for a planning phase, declare the verdict explicitly:

- `PASS` — All validations passed, quality bar met, no blocking findings.
- `PASS WITH NOTES` — All validations passed, non-blocking concerns documented.
- `FAIL` — Blocking issues remain. Cannot ask for approval.

### Approval Questions

After completing a planning phase with a PASS or PASS WITH NOTES verdict, end with a direct approval question:

- `Verdict: PASS. Approve Phase 1, and I'll move to Phase 2 (design).`
- `Verdict: PASS. Approve Phase 2, and I'll move to Phase 3 (tasks).`
- `Verdict: PASS. Approve Phase 3, and I'll proceed to Red Team Review.`

## Unified Quality Gate Protocol

Each spec phase (Requirements, Design, Tasks) uses a single unified quality gate after writing the artifact. This replaces multiple separate evaluations with one consolidated gate.

### Steps

1. **CLI Validation** — Run the appropriate `sds validate` command against the written artifact.
2. **Quality Bar Self-Check** — Complete the skill's quality bar checklist (each skill defines its own checklist).
3. **Fix Failures** — If validation fails or self-check items are not met, fix the artifact and re-run validation.
4. **Declare Verdict** — Based on evidence:
   - `PASS` if all validations pass and all quality bar items are checked.
   - `PASS WITH NOTES` if all validations pass but non-blocking concerns exist (document them).
   - `FAIL` if any validation fails or blocking issues remain after fix attempts.

### Fix Loop Rules

- After each fix attempt, re-run the validation command.
- After 3 failed validation attempts, summarize remaining errors and ask: "Should I proceed with best-effort corrections?"
- If yes: make corrections, document assumptions, proceed with `PASS WITH NOTES`.
- Never declare `PASS` or `PASS WITH NOTES` unless the validation command was actually run and its output observed.

### Evidence Required for PASS

- CLI validation passed (actual command output observed)
- All quality bar self-check items verified
- No blocking findings from self-review

## Validation CLI Commands

After writing a spec artifact, validate it using the CLI. Do not claim validation passed unless the command was actually run and its output was observed:

### Requirements Validation

```bash
sds validate requirements .specs/changes/<slug>/requirements.md
```

### Design Validation

```bash
sds validate design .specs/changes/<slug>/design.md --requirements .specs/changes/<slug>/requirements.md
```

### Tasks Validation

```bash
sds validate tasks .specs/changes/<slug>/tasks.md --design .specs/changes/<slug>/design.md --requirements .specs/changes/<slug>/requirements.md
```

### Full Spec Validation

```bash
sds validate spec <slug>
```

**Note:** Both `sds` and `spec-driven-steroids` work interchangeably as the CLI command name.

## Per-Phase Todo List Format

When a phase skill begins execution, it creates a todo list of work items. This list is scoped to that phase only — do not carry over items from any previous phase.

### Todo Creation

Create a todo list containing the following items in `pending` state:

1. Read project guidelines
2. Retrieve contextual memory
3. Analyze/Design/Decompose based on phase
4. Write artifact
5. Run CLI validation
6. Complete quality bar self-check
7. Fix validation failures (if any)
8. Declare verdict

### Progress Rules

- Mark an item `in_progress` when starting that work step.
- Mark an item `completed` only after the work step has been verified.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when the phase begins; do not append to a prior phase's list.
