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
4. Work inline by default. Delegate targeted investigation only when useful and supported, regardless of tool name; do not repeat delegated searches or require an agent feature.
5. Write `.specs/changes/<slug>/brief.md` using the exact format below.
6. Run `sds validate structure <slug>` and `sds validate brief .specs/changes/<slug>/brief.md`.
7. Fix validation failures and re-run both commands.
8. Stop and ask: `Verdict: PASS. Approve brief <slug> for implementation?`

Before writing, verify every Existing evidence path against current source and justify each New path. Every task Files path must have a matching Repository Evidence entry. Select verification commands from actual project scripts or establish a concrete observable manual check, not a generic promise that tests will pass.

If CLI execution is unavailable, provide the exact validation commands and request observed results from the user; do not invent a PASS or switch lanes to bypass missing tools. New briefs must resolve evidence and verification warnings before being presented for approval. Warnings on legacy briefs are not permission for a template-driven rewrite.

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
- Use a backticked verification command or `Check: <action> => <observable outcome>`. This syntactic signal is not proof of adequate verification; inspect what the check actually exercises.
- Every task Files path must have a matching Existing or New entry in Repository Evidence. Normalize separators and leading `./` consistently; do not replace file evidence with broad directory guesses.
- Cover every requirement with at least one task.
- Use exact existing or proposed paths; do not leave placeholders.
- Do not use `DES-*` IDs in the brief lane.
- Final Verification must exercise the changed user or system path, with negative/boundary checks where relevant, not merely repeat a generic "tests pass" statement.

## Approved Implementation

After explicit approval:

1. Re-read the approved brief and changed working-tree state.
2. Implement all pending tasks in order without asking between tasks.
3. Mark each task `[~]` when starting and `[x]` immediately after its focused verification passes.
4. Reuse still-current repository and verification evidence. Re-read changed files and re-establish evidence after interruption or context loss.
5. Run every item under `Final Verification`.
6. Stop only for failed verification that cannot be fixed locally, material ambiguity, user conflict, a safety-floor violation, or a proposed lane transition. Material plan changes require renewed approval, not silent edits to the approved intent.

## Compact Review

Run one compact review after implementation. Use an independent reviewer if any sub-agent spawning capability is available; otherwise perform a structured adversarial self-review inline. Do not rely on a tool literally named `Task` or on native agent support.

Give a separate reviewer this standalone context, or use it as the explicit inline checklist:

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
6. Every task Files path is backed by Repository Evidence, and final checks exercise the changed path.

For every check, cite the relevant source/diff and the observed verification command/results as applicable. Re-read Intent and Non-Goals against the actual diff. A passed test name without its observed result is not sufficient evidence.

Return:
- Verdict: APPROVE | APPROVE WITH NOTES | REQUEST CHANGES
- Blocking findings: [list]
- Non-blocking findings: [list]
- Review mode: independent | inline adversarial
- Check evidence: [criterion, source/diff, command/result]
```

Fix blocking findings, rerun verification affected by the fix, and perform one focused follow-up review. Do not introduce unrelated acceptance criteria. If blockers remain, report REQUEST CHANGES and keep the work incomplete rather than forcing approval.

When independent review is unavailable, state that limitation and the inline review performed. If some review capability is unavailable, APPROVE WITH NOTES is allowed only when every required verification was actually observed passing and no blocking finding remains. Missing or failed required checks mean REQUEST CHANGES, not automatic approval with a limitation note.

## Quality Bar

Before requesting approval, verify:

- [ ] CLI validation passed against the written file
- [ ] scope fits the brief lane
- [ ] repository evidence supports every planned touchpoint
- [ ] every task Files path has a verified Existing or justified New evidence entry
- [ ] every Verify has a concrete executable command or observable Check
- [ ] Final Verification covers the actual changed path
- [ ] every requirement has implementation and verification coverage
- [ ] no placeholders remain
- [ ] no implementation code was written
