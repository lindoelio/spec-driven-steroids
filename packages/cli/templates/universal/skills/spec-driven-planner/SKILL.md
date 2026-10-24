---
name: spec-driven-planner
description: Use this skill to plan and implement approved Spec-Driven work in any harness. Brief is the default; use full only when separate requirements, design, and tasks reviews offer a concrete advantage or the user requests them. Default path: inspect targeted evidence, select a lane, write and validate its artifact, stop for human approval, then execute the approved scope and review it.
---

# Spec-Driven Planner

This skill is the authoritative orchestration contract, whether invoked directly, through a command, or through a native agent. Entry points only route here. If their instructions conflict with this skill, follow this skill; never weaken human approval or the host's safety permissions.

## Lane Selection

Read `references/lane-selection.md` before selecting, resuming, or changing a lane. It is the single source for selection precedence, escalation criteria, slicing, and lane transitions. Do not infer the lane from a keyword, file count, or task count.

### Brief Lane

Brief is the default. Invoke the `spec-driven-brief-planner` skill directly; no native agent or sub-agent capability is required. It owns the compact artifact, evidence, approval, execution, and review contract.

### Full Lane

When full is selected, read `references/full-lane-phases.md` and invoke the phase skills in order. It owns the full lifecycle, phase approvals, stop rule, discovery, Red Team Review, and Code Review. Do not load the full lifecycle merely to execute a brief.

### No Direct Lane

This toolkit has no direct lane. Direct execution without a planning artifact belongs to the host harness outside SDS. Treat `lane:direct` as invalid rather than bypassing approval.

## Shared Protocol

The `spec-driven-shared-protocol` skill supplies context-preflight, validation commands, and the Unified Quality Gate. Phase skills own their document formats and local quality checks. Do not copy their contracts into entry points.

## Approval And Resumption

- Every lane must write and validate its planning artifact, then stop for explicit human approval before implementation.
- Choosing a lane, requesting a full spec, or approving a transition is not approval to implement it.
- Before approval, do not edit implementation files. Write only the active lane's planning artifacts; archive prior artifacts only during an explicitly approved lane transition.
- Resume the approved artifact and current working-tree state, not recollection. If approval cannot be established from the conversation or a trustworthy persisted record, ask instead of inferring it from the file's existence or task markers.
- Material changes to behavior, scope, contracts, architecture, or risk require renewed review and approval. Implementation details within an approved scope may be amended under the active skill's protocol.
- Full-lane phase transitions require explicit human approval. Their Non-Skippable Stop Rule is defined in `references/full-lane-phases.md`.

## Harness Capabilities

Discover the available capabilities, not a particular tool name. Use a separate reviewer when the host exposes any sub-agent spawning facility. Otherwise perform a structured adversarial review inline and label it honestly as a self-review, not an independent review.

Missing reviewer, memory, or shell tools must not cause skipped approval, invented evidence, or an automatic change to full. Report unavailable verification explicitly. Blocking checks remain blocking; a review limitation is not evidence of passing them.

## Completion

Execute only the scope the user approved, following the selected execution skill. Verify each task before marking it complete, preserve requirement traceability, and report actual verification and review results. Do not claim success when required verification failed or was not performed.
