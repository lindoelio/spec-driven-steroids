---
name: spec-driven-brief-planner
description: Use this skill for the default brief workflow, directly or through the spec-driven-planner skill in any harness. Default path: inspect targeted evidence, write and validate brief.md, stop for one human approval, implement the approved plan, and run a compact evidence-backed review.
---

# Spec-Driven Brief Planner

Use one compact artifact and one approval for changes that do not require the full requirements, design, and tasks lifecycle.

## Contract

- Write `.specs/changes/<slug>/brief.md` before implementation.
- Do not write implementation code until the user explicitly approves the brief.
- Do not create `requirements.md`, `design.md`, or `tasks.md` in the brief lane.
- For lane selection, slicing, safety, or transitions, follow `spec-driven-planner/references/lane-selection.md`. Do not decide full from task volume or incidental terminology.

## Lane Selection

Read the lane-selection reference in the `spec-driven-planner` skill before planning, including direct invocation of this skill. Brief is the normal path. Do not require a native agent or a separate lane approval. Record the lane rationale in Intent and any explicitly accepted lane risk under Risks.

## Planning Workflow

1. Propose a short URL-friendly slug.
2. Read only repository guidance relevant to this change.
3. Inspect targeted existing code before naming files or verification commands.
4. Work inline by default. Use at most one explore sub-agent only when the investigation would otherwise require more than three independent searches. Do not repeat delegated searches.
5. Write `.specs/changes/<slug>/brief.md` using the exact format below.
6. Run `sds validate structure <slug>` and `sds validate brief .specs/changes/<slug>/brief.md`.
7. Fix validation failures and re-run both commands.
8. Stop and ask: `Verdict: PASS. Approve brief <slug> for implementation?`

## Brief Format

```markdown
# Change Brief

**Lane:** brief

**Slice:** N/M

## Intent

<problem, expected outcome, and scope boundary>

## Non-Goals

- <explicitly excluded behavior>

## Acceptance Criteria

- REQ-1: <observable outcome>
- REQ-2: <observable outcome>

## Repository Evidence

- Existing: `path/to/file.ts` - <evidence and role in the change>
- New: `path/to/test.ts` - <planned role>

## Implementation Plan

- [ ] 1. <concrete action>
  - Change: <exact scoped change>
  - Files: `path/to/file.ts`
  - Verify: `focused command or observable check`
  - _Implements: REQ-1_

## Risks

- <optional low or medium risk>

## Final Verification

- `final command or observable check`
```

`**Slice:** N/M` is optional; omit it for unsliced work and resolve it to actual numbers when used. `## Risks` is optional unless required by the lane-selection policy. Every other section is required and must stay in the shown order.

## Brief Rules

- Use 1-5 sequential `REQ-N` acceptance criteria.
- Use 1-8 sequential checkbox tasks.
- Keep acceptance criteria observable and implementation-independent.
- Give every task `Change`, `Files`, `Verify`, and `_Implements` fields.
- Cover every requirement with at least one task.
- Use exact existing or proposed paths; do not leave placeholders.
- Do not use `DES-*` IDs in the brief lane.

## Approved Implementation

After explicit approval:

1. Re-read the approved brief and changed working-tree state.
2. Implement all pending tasks in order without asking between tasks.
3. After a task's focused verification passes, mark it `[x]` immediately.
4. Do not re-read a file already read in the current session unless it was modified.
5. Run every item under `Final Verification`.
6. Stop only for failed verification that cannot be fixed locally, material ambiguity, user conflict, or full-lane escalation.

## Compact Review

Run exactly one independent compact review after implementation.

If a `Task` tool is available, launch one `general` sub-agent with:

```text
Task: Brief Review for <slug>

Read:
- .specs/changes/<slug>/brief.md
- changed implementation files

Evidence:
- verification commands already run and their outcomes

Check:
1. Every REQ-N is implemented and verified.
2. The diff stays within Intent and Non-Goals.
3. File deviations are justified.
4. Tests exercise real behavior and are not skipped, hardcoded, or mocked past the behavior under test.
5. Reuse existing verification evidence; rerun only if it is absent or stale.

Return:
- Verdict: APPROVE | APPROVE WITH NOTES | REQUEST CHANGES
- Blocking findings: [list]
- Non-blocking findings: [list]
```

If no `Task` tool exists, perform the same review inline. Fix blocking findings and re-review once. Do not raise the acceptance bar or introduce unrelated findings in the second pass.

## Quality Bar

Before requesting approval, verify:

- [ ] CLI validation passed against the written file
- [ ] scope fits the brief lane
- [ ] repository evidence supports every planned touchpoint
- [ ] every requirement has implementation and verification coverage
- [ ] no placeholders remain
- [ ] no implementation code was written
