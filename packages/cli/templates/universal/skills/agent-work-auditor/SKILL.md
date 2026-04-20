---
name: agent-work-auditor
description: >
  Unified auditing skill for AI agent workflows.
  Provides change-type-aware, artifact-adaptive auditing with self-fix capabilities.
  Works standalone or with spec-driven extensions.
  Three-layer architecture: core (always active), modules (per-type), extensions (auto-detected).
---

# agent-work-auditor

A unified, modular auditing framework for AI agent workflows. Provides consistent,
comparable audits across any change type with adversarial questioning that probes
for gaps rather than merely validating form.

## Activation

Load this skill when:

- User asks to audit code, a PR, a change set, or a specification
- User mentions "are you sure?" after producing work
- User wants verification of completeness or correctness
- Spec-driven phase requires auditing before approval

## Three-Layer Architecture

### Layer 1: Core (Always Active)

Universal dimensions evaluated for every audit:

| Dimension | Question | Auto-Fix |
|-----------|----------|----------|
| Completeness | Is everything present? | Yes |
| Correctness | Is it right? | Yes |
| Consistency | Does it fit patterns? | Yes |
| Traceability | Can we trace it? | Partial |
| Safety | Could it cause harm? | No |
| Maintainability | Will future devs thank us? | Partial |

### Layer 2: Change-Type Modules (Per-Invocation)

Loaded based on detected change type:

| Type | Posture | Focus |
|------|---------|-------|
| feat | Thorough | Design, scalability |
| fix | Focused | Bug repro, verification |
| hotfix | Compressed | Scope min, correctness |
| refactor | Rigorous | Behavioral parity |
| migrate | Cautious | Backward compat, schema |
| docs | Lightweight | Accuracy |

### Layer 3: Context Extensions (Auto-Detected)

Activated when relevant context is detected:

- `spec-driven` — When `.specs/` or spec artifacts found
- (Extensible for future context types)

## Invocation

### Input Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `artifact` | Yes | — | Path(s) to audit |
| `changeType` | No | auto-detect | feat, fix, hotfix, refactor, migrate, docs, general |
| `mode` | No | standard | quick, standard, thorough |
| `extensions` | No | auto | Array of extension names |

### Invocation Patterns

```text
# Explicit type
"Audit this PR using agent-work-auditor, type:feat"

# Quick check
"Quick audit on these changes"

# Spec-driven (auto-loads spec-driven extension)
"Validate the spec implementation"

# Combined types
"Audit this refactor+fix"
```

## Audit Workflow

```
1. DETECT change type
   └─ Explicit tag → Branch scan → Commit scan → Heuristic → Fallback

2. DETECT artifact type
   └─ code | specification | design | tasks | mixed

3. GATHER context
   └─ Style guide, conventions, project docs

4. ACTIVATE layers
   └─ Core (always) → Type module → Extensions (if detected)

5. EVALUATE dimensions
   └─ Universal (6) → Type-specific → Extension-specific

6. CLASSIFY findings
   └─ Severity (blocking, warning, info)
   └─ Fixability (direct-fix, author-required, informational)

7. SELF-FIX LOOP
   └─ Pass 1: Apply direct-fix → Re-review
   └─ Pass 2: Apply direct-fix → Re-review
   └─ Escalate remaining to author-required

8. OUTPUT
   └─ Markdown report + JSON (machine consumption)
```

## Finding Classification

### Severity Axis

| Level | Label | Blocks Approval? |
|-------|-------|-----------------|
| Blocking | Must Fix | Yes |
| Warning | Should Fix | No |
| Info | FYI | No |

### Fixability Axis

| Level | Label | Action |
|-------|-------|--------|
| direct-fix | Auto-Fix | Agent applies immediately |
| author-required | Human Decision | Author must resolve |
| informational | Mentoring | FYI only |

### Prefixes

- No prefix for blocking findings
- `Nit:` for non-blocking polish suggestions
- `Mentoring:` for educational comments

## Self-Fix Loop

1. For each `direct-fix` finding:
   - Apply the fix autonomously
   - Re-review to verify no new issues
   - If new blocking issues: rollback, mark author-required

2. Max 2 passes to prevent infinite loops

3. After max passes, escalate remaining direct-fix to author-required

## Output Format

### Markdown Report

```markdown
# Audit Report — {change-type}

**Artifact:** {path}
**Timestamp:** {ISO-8601}
**Verdict:** Approve | Request Changes | Approval with Notes

## Summary
{2-3 sentence assessment}

## Direct Fixes Applied
| Finding | Fix Applied | Status |
|---------|-------------|--------|
| ... | ... | fixed |

## Blocking Findings
| Finding | Decision Needed | Status |
|---------|---------------|--------|
| ... | ... | pending |

## Nit Findings
| Finding | Suggestion | Status |
|---------|------------|--------|
| ... | ... | fixed |

## Traceability Matrix (spec-driven only)
| REQ | DES | TASK | Coverage |
|-----|-----|------|----------|
```

### JSON Output

```json
{
  "artifact": "{path}",
  "changeType": "{type}",
  "timestamp": "{ISO-8601}",
  "verdict": "Approve | Request Changes | Approval with Notes",
  "dimensions": {
    "{dimension}": {
      "score": 1-5,
      "findings": []
    }
  },
  "findings": [
    {
      "severity": "blocking | warning | info",
      "fixability": "direct-fix | author-required | informational",
      "title": "...",
      "description": "...",
      "fix": "...",
      "status": "fixed | pending | escalated"
    }
  ],
  "summary": "..."
}
```

## Context Detection

Detection happens in priority order:

1. **Explicit config** (`auditor.json`) — apply configured defaults
2. **Directory scan** (`.specs/`) — auto-load spec-driven extension
3. **File scan** (requirements.md, design.md, tasks.md) — auto-load spec-driven
4. **Package scan** (package.json, Cargo.toml) — domain inference
5. **Fallback** — general-purpose audit

## Portability

- Zero external dependencies
- Works standalone in any project
- Optional `auditor.json` for configuration

## Reference Loading

Load reference files on demand:

| File | When |
|------|------|
| `dimensions/*.md` | During dimension evaluation |
| `modules/{type}.md` | After type detection |
| `extensions/spec-driven.md` | When `.specs/` detected |
| `references/migration/*` | When migrate type detected |
| `references/finding-severity.md` | During finding classification |
| `references/output-format.md` | During output generation |

## Migration Auditing

When `migrate` type is detected:

1. **Phase 0 (Gating)**: Codebase Inventory must complete before requirements
2. **Eight Dimensions**: DIM-1 through DIM-8 with 1-5 scoring
3. **Prove-It Challenges**: Agent must demonstrate comprehension
4. **Approval Threshold**: ALL 8 dimensions must score 4+ (any <4 blocks)

See `references/migration/` for detailed migration auditing.