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

## Sub-Agent Delegation Protocol

This protocol governs how the orchestrator delegates work to sub-agents on platforms that support a `Task` tool (e.g., OpenCode).

### When To Delegate

The orchestrator delegates to sub-agents for:

1. **Red Team Review** — After Phase 3 approval, before Phase 4 starts
2. **Code Review** — After all implementation tasks are complete
3. **Parallel Implementation** — When executing a phase or full feature with independent task batches

### Sub-Agent Context Bundle

Every delegated sub-agent receives a self-contained context bundle. The orchestrator constructs this bundle before spawning the sub-agent:

#### Red Team Review Sub-Agent Bundle
```
Task: Red Team Review for <slug>

Artifacts to review:
- .specs/changes/<slug>/requirements.md
- .specs/changes/<slug>/design.md
- .specs/changes/<slug>/tasks.md

Instructions:
1. Read all three artifacts.
2. Use agent-work-auditor/artifacts/{requirements,design,tasks}.md for review questions.
3. Focus on cross-artifact issues: traceability gaps, requirement-to-design mismatches, task coverage holes, scope creep, ambiguous acceptance criteria.
4. Produce a structured verdict with classified findings.

Return:
- Verdict: PASS | PASS WITH NOTES | FAIL
- Blocking findings: [list]
- Non-blocking findings: [list]
```

#### Code Review Sub-Agent Bundle
```
Task: Code Review for <slug>

Artifacts to review:
- .specs/changes/<slug>/requirements.md
- .specs/changes/<slug>/design.md
- .specs/changes/<slug>/tasks.md
- Changed files: <list from git diff --name-only against base branch>

Instructions:
1. Read all spec artifacts and changed files.
2. Invoke agent-work-auditor with spec-driven extension.
3. Invoke universal-live-check for final validation.
4. Verify implementation traces to DES-* and REQ-*.
5. Produce a structured verdict.

Return:
- Verdict: APPROVE | APPROVE WITH NOTES | REQUEST CHANGES
- Findings: [list]
- Validation output: [summary]
```

#### Implementation Task Sub-Agent Bundle
```
Task: Implement task <task-id>: <task title>

Context files:
- .specs/changes/<slug>/requirements.md
- .specs/changes/<slug>/design.md
- .specs/changes/<slug>/tasks.md

Task to implement:
<copy the full task line from tasks.md including all metadata>

Rules (from spec-driven-task-implementer):
1. Read tasks.md, find this task, mark it - [~] and save.
2. Implement only the scoped behavior required by this task.
3. Follow design.md for architecture and file placement.
4. Follow project guidelines for naming, patterns, and structure.
5. Run the smallest meaningful verification.
6. If verification passes, mark the task - [x] and save tasks.md.
7. If verification fails, keep at - [~] and fix.
8. If the task discovers additional in-scope work, apply the Task Amendment Protocol.

Return:
- Changed files: [list of files modified or created]
- Verification outcome: passed | failed
- Task status: [x] | [~]
- Discovery notes: [any amendments or observations]
```

### Orchestrator Responsibilities

When using sub-agents, the orchestrator:

1. Builds and sends the appropriate context bundle
2. Launches sub-agents simultaneously for parallel batches
3. Collects results from all sub-agents
4. Reconciles results against `tasks.md` and spec artifacts
5. Re-spawns or handles failed tasks before proceeding
6. Falls back to inline execution if the `Task` tool is not available
