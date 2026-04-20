# Spec-Driven Extension

Auto-activates when `.specs/` directory or spec artifacts are detected.

**Note:** "Rigorous Against Prompt/Spec" is a CORE dimension (always active for every audit). This extension provides additional spec-specific verification beyond that core check.

## Activation Triggers

- `.specs/` directory exists
- `requirements.md` found in audit scope
- `design.md` found in audit scope
- `tasks.md` found in audit scope
- `SPEC.md` found in audit scope

## Audit Checks

### 1. Traceability Coverage

Verify the complete REQ → DES → TASK → CODE chain:

| Check | Description |
|-------|-------------|
| REQ coverage | Every REQ-* has at least one DES-* implementing it |
| DES coverage | Every DES-* implements at least one REQ-* |
| TASK coverage | Every DES-* has at least one TASK implementing it |
| CODE coverage | Every TASK has corresponding code changes |

### 2. Phase Gate Compliance

Verify prerequisite phases are complete:

| Phase | Prerequisite |
|-------|-------------|
| Requirements | None |
| Design | Requirements approved |
| Tasks | Design approved |
| Implementation | Tasks approved |

### 3. Spec-Specific Adherence

Additional spec-driven checks beyond CORE "Rigorous Against Prompt/Spec":

- Code changes match TASK descriptions
- No scope creep (changes outside spec scope)
- No descoping without explicit approval
- Phase gate sequencing is correct

### 4. Scope Creep Detection

Flag changes that are:
- Outside the approved spec scope
- Adding features not in requirements
- Removing features from scope without approval

## Finding Classification

| Finding | Severity | Fixability |
|---------|----------|------------|
| Missing REQ→DES trace | blocking | direct-fix |
| Missing DES→TASK trace | blocking | direct-fix |
| Phase gate violation | blocking | author-required |
| Implementation mismatch | blocking | author-required |
| Scope creep | warning | author-required |

## Output Extension

When active, the audit report includes:

```markdown
## Traceability Matrix
| REQ | DES | TASK | Coverage |
|-----|-----|------|----------|
| REQ-1 | DES-1 | TASK-1.1 | Covered |
```

## Composition with Migrate

When both `migrate` module and `spec-driven` extension are active:

- Migration findings link to REQ-*/DES-* identifiers
- DIM findings reference spec elements where applicable
- Phase 0 gates are enforced before spec phase progression