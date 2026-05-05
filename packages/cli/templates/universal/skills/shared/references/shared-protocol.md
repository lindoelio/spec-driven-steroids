# Shared Protocols

This file contains shared protocols referenced by all four phase skills. These protocols are duplicated across phase skills and are extracted here to reduce redundancy.

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

### Approval Questions

After completing a planning phase, end with a direct approval question:

- `Approve Phase 1, and I'll move to Phase 2 (design).`
- `Approve Phase 2, and I'll move to Phase 3 (tasks).`
- `Approve Phase 3, and I'll move to Phase 4 (implementation).`

### Skill Invocation Guard

When invoking any spec-driven skill, you MUST follow this exact sequence:

1. Invoke the skill
2. Provide the collected guideline, contextual-memory, and pattern evidence as input to the skill
3. Wait for the skill to produce its artifact
4. Write the artifact to the appropriate file path
5. Run the validator against the written file, fix failures in the file, and re-run validation until it passes or a real blocker is reported
6. **STOP** — Do NOT invoke the next skill or continue to the next phase
7. Summarize the artifact and ask for explicit human approval

The skill's output or "direct" production of content does NOT mean the phase is complete. You MUST stop after writing the artifact and await approval before proceeding.

## Validation CLI Commands

After writing a spec artifact, validate it using the CLI. Do not claim validation passed unless the command was actually run and its output was observed:

### Requirements Validation

```bash
sds validate requirements .specs/changes/<slug>/requirements.md
```

Example:
```bash
sds validate requirements .specs/changes/my-feature/requirements.md
```

### Design Validation

```bash
sds validate design .specs/changes/<slug>/design.md --requirements .specs/changes/<slug>/requirements.md
```

Example:
```bash
sds validate design .specs/changes/my-feature/design.md --requirements .specs/changes/my-feature/requirements.md
```

### Tasks Validation

```bash
sds validate tasks .specs/changes/<slug>/tasks.md --design .specs/changes/<slug>/design.md --requirements .specs/changes/<slug>/requirements.md
```

Example:
```bash
sds validate tasks .specs/changes/my-feature/tasks.md --design .specs/changes/my-feature/design.md --requirements .specs/changes/my-feature/requirements.md
```

### Full Spec Validation

```bash
sds validate spec <slug>
```

Example:
```bash
sds validate spec my-feature
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
5. Validate artifact
6. Audit artifact (agent-work-auditor)

### Progress Rules

- Mark an item `in_progress` when starting that work step.
- Mark an item `completed` only after the work step has been verified.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when the phase begins; do not append to a prior phase's list.
