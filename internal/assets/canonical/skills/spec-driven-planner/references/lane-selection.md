# Lane Selection And Transitions

Brief is the default. Full is a planning investment, not a label for every consequential change. A capable model or a large context window does not replace evidence, human approval, or verification.

## Selection Precedence

Inspect only the current change's active artifacts; do not use unrelated historical specs as repository evidence.

1. If brief and full artifacts are mixed at the active directory root, stop and report the invalid structure. Never choose or delete one silently.
2. Honor an explicit `lane:brief`, `lane:full`, or request for the full requirements/design/tasks set. If explicit instructions contradict one another, ask one clarification; do not silently assign precedence between two conflicting user instructions.
3. If that choice contradicts an existing lane, ask once before a transition. Without an explicit override, resume the existing lane; do not restart it or invalidate approvals merely because the default changed.
4. For a new change without an explicit choice, investigate the considerations below. Recommend full only when evidence shows a concrete advantage from separate requirements, design, and tasks approval. Explain that advantage in one sentence and ask for confirmation. If the user prefers brief, record the residual risk and continue within its safety floor.
5. Otherwise choose brief. Do not add a separate lane-confirmation stop to the normal brief path; its artifact approval confirms the plan and lane together.

Record `Lane rationale:` in the brief's `Intent` or the full requirements' `Overview`. Use `Lane risk:` under `Risks` when the user chooses brief despite a full recommendation. A recommendation alone is not accepted risk or implementation approval.

## Escalation Considerations

These six considerations prompt investigation, not automatic escalation:

1. **Irreversibility:** irreversible or destructive effects, such as loss of data that a code revert cannot restore.
2. **External contracts:** a contract consumed outside this repository, including public APIs, wire formats, published packages, and CLI behavior.
3. **Persistence:** persisted data, schemas, migrations, or stored formats with compatibility or recovery implications.
4. **Architectural boundaries:** changes across packages, services, or runtimes, or a new production dependency that changes operational assumptions.
5. **Security posture:** actual handling of secrets, authentication, authorization, personal data, or compliance obligations, not incidental terminology.
6. **Critical runtime behavior:** concurrency, availability, or performance whose failure threatens a critical user or operational path.

For each relevant consideration, identify the affected behavior, evidence, uncertainty, and mitigation. Then answer: what decision would benefit from separate review before implementation? Recommend full when that separation resolves material uncertainty, coordinates coupled contracts, or makes a complex recovery/rollout reviewable. A routine dependency addition, bounded migration, or localized authorization fix can remain brief when its implications and checks fit a coherent compact plan.

Do not escalate because of an incidental word, a number of files, or task volume alone. If uncertainty prevents a safe plan, investigate or ask a targeted question first; full is not a substitute for missing evidence.

## Safety Floor

Before approving destructive work in a brief, document an executable rollback or recovery strategy, its prerequisites, and how it is verified under `Risks`. If no credible recovery can be provided, do not proceed in brief: recommend full for explicit mitigation and irreversible-risk review. Full still does not authorize destructive execution or waive host permissions.

## Slicing Bounded Work

The brief artifact retains its structural budget of 1–5 requirements and 1–8 checkbox tasks, including test tasks. Exceeding that budget is not a full-lane trigger.

Propose coherent, ordered slices if either budget would be exceeded. Use a separate sibling slug per slice so each active directory has exactly one `brief.md`. Each slice must have observable value, verification, and its own approval; do not combine unrelated work or hide requirements merely to meet a count.

Add optional `**Slice:** N/M` immediately below `**Lane:** brief`. Name sibling slugs, ordering, and dependencies in `Intent` and `Non-Goals`. This metadata is a textual convention, not a new lane or persisted orchestration format. Do not approve or execute future slices implicitly. If the work cannot be separated coherently, explain why a full plan offers more value instead of forcing artificial slices.

## Lane Transitions

Stop implementation before proposing a transition and obtain explicit human approval for the transition itself. Preserve source evidence, completed work, and verification results; never erase them to make a new plan appear unstarted.

### Brief To Full

1. Explain the new evidence and why separate reviews now help. Request transition approval before moving artifacts.
2. Archive the active `brief.md` under `.archive/`. Preserve the original snapshot unchanged. If that name already exists, choose a fresh snapshot directory; never overwrite an archive.
3. Seed `requirements.md`: map Intent and Non-Goals to Overview; map each REQ-N outcome to full requirements with user stories and EARS acceptance criteria. Record the origin and lane rationale.
4. Carry repository evidence forward into design investigation and prior plan steps into task-decomposition input, not into automatically approved tasks. Identify existing implementation accurately and map verification to the revised plan.
5. Validate requirements and stop for Phase 1 approval. Every subsequent full-lane gate still applies.

### Full To Brief

Offer this only before Phase 1 requirements approval, when investigation shows separate reviews provide no useful advantage. If approved requirements already exist, resume full; do not silently discard that approved contract.

1. Explain the evidence and request transition approval.
2. Archive any active requirements/design/tasks documents unchanged under `.archive/`, avoiding snapshot collisions.
3. Consolidate the investigated scope into `brief.md`, preserving relevant evidence and rationale.
4. Validate structure and brief, then request brief implementation approval. Transition approval is not brief approval.

The active root must contain only the selected lane's artifacts. `.archive/` holds inactive snapshots and is not a second active lane. If a transition is interrupted, inspect both source and archive, preserve all versions, and finish or restore a single active lane with the user's approved intent before implementing.
