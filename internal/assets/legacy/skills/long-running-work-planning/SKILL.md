---
name: long-running-work-planning
description: Use this skill when facing long-running or heavy work that must continue without user intervention, especially large task decomposition, multi-task implementation, complex debugging, migrations, or work where context/tool limits are likely. It turns work into durable checkpoints so the agent can keep making progress for hours and resume safely after interruption.
license: MIT
---

# Long-Running Work Planning

Make extended agent work durable, resumable, and observable. The primary goal is not deeper private reasoning; it is keeping progress outside the model context through files, task states, checkpoints, and verification.

## Core Principle

For heavy work, never rely on memory or a long internal chain of thought as the source of truth.

Use durable artifacts instead:

- `requirements.md`, `design.md`, and `tasks.md` for spec-driven work
- task status markers in `tasks.md`
- small verified batches
- explicit checkpoint summaries in the working artifact or final response
- validation output as the gate for marking work complete

## Strategy Selection

Choose the smallest strategy that keeps progress recoverable:

| Situation | Strategy |
|-----------|----------|
| Spec-driven planning phase | Write one complete phase artifact, validate it, stop for approval |
| Heavy task decomposition | Decompose into small tasks with dependencies, verification, and traceability |
| Heavy implementation | Treat `tasks.md` as the durable queue and continue task-by-task |
| Debugging with unclear root cause | Create hypotheses, test them one at a time, record the current best finding |
| Context is getting large | Write a resume checkpoint before continuing |
| Validation fails | Fix if local and clear; otherwise mark blocked with evidence |

## Durable Execution Protocol

Use this protocol whenever work could exceed one comfortable response or tool cycle.

1. Identify the durable source of truth.
2. Break the work into small units that can be verified independently.
3. Mark the current unit in progress before editing.
4. Complete only that unit or a small batch of tightly related units.
5. Run the smallest meaningful verification.
6. Persist status immediately after verification.
7. Emit a concise progress update when useful.
8. Continue until all units are complete, a real blocker appears, or phase rules require approval.

## Spec-Driven Usage

### Requirements, Design, And Tasks Phases

For planning phases, complete at most one phase per user approval.

- Draft the phase artifact under `.specs/changes/<slug>/`.
- Validate the artifact with the appropriate `sds validate` command.
- Apply quality improvements requested by the active phase skill.
- Stop after writing the artifact and ask for explicit approval.
- Do not start the next phase in the same turn.

### Task Decomposition Phase

When tasks are large or numerous, optimize for execution safety:

- Prefer tasks that affect a small number of files.
- Give each task a clear completion condition.
- Include a minimal verification command or check for each task.
- Preserve `_Implements:` traceability tags.
- Order tasks so each task can be resumed independently.
- Split tasks that require unrelated code paths, broad rewrites, or multiple validation modes.

### Implementation Phase

After Phase 4 is approved, work autonomously through `tasks.md`.

- Find the next pending task.
- Mark it `[~]` or the repository's in-progress marker before editing.
- Make the smallest correct change for that task.
- Run the task's verification or the smallest relevant validation.
- Mark it `[x]` only after verification succeeds.
- Save `tasks.md` immediately after every status change.
- Continue to the next pending task without asking the user unless blocked.

Stop only when:

- all requested tasks are complete
- validation fails and the failure is not locally fixable
- the working tree contains a direct conflict with user changes
- requirements/design/tasks are ambiguous enough that continuing risks wrong behavior

## Resume Checkpoints

Create a checkpoint when any threshold is reached:

- more than 5 implementation tasks are complete in one run
- more than 10 files have been touched
- context is becoming crowded
- validation output is lengthy
- a task is blocked
- the next task depends on a decision made during the current run

Checkpoint format:

```md
Checkpoint:
- Completed: <task IDs or short descriptions>
- Current: <task ID/status>
- Verification: <commands and result>
- Next: <next pending task>
- Blockers: <none or exact blocker>
```

Prefer writing checkpoints into the durable artifact when the artifact has a suitable progress/status section. Otherwise include the checkpoint in the response before continuing or stopping.

## Progress Visibility

Keep the user informed without turning every small action into narration.

Good progress updates:

- identify the batch being worked
- mention meaningful discoveries
- report validation failures with evidence
- summarize completed units

Avoid:

- verbose private reasoning
- dumping every internal step
- asking for permission between implementation tasks after Phase 4 approval
- holding all output until many tasks are complete

## Handling Failures

When a command or validation fails:

1. Read the failure carefully.
2. If the cause is local and clear, fix it and rerun the smallest validation.
3. If the cause is unrelated to the current task, record it as residual risk and continue only if safe.
4. If the cause blocks the current task, mark the task blocked and include the exact failure.
5. Never mark a task complete without successful verification or an explicit explanation of why verification could not run.

## When To Use

Use this skill for:

- large task decomposition
- long implementation runs
- migrations or refactors across many files
- complex debugging with uncertain root cause
- work that could hit context, time, or tool limits
- tasks that need autonomous continuation after approval

Skip this skill for:

- single-step edits
- simple factual answers
- small documentation changes
- straightforward commands with immediate output

## Relationship To External Reasoning Tools

External reasoning tools can be useful when already available, but they are optional. Do not depend on them for long-running execution. Durable progress must live in repository artifacts and verification results, not in a reasoning transcript.

## Reference

For additional execution heuristics, see [references/decision-framework.md](references/decision-framework.md).
