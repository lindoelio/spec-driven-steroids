---
name: spec-driven-technical-designer
description: Use this skill when approved requirements need to be translated into a design.md file for Phase 2 of a Spec-Driven change. It creates a traceable technical design with validator-safe Mermaid diagrams and should not be used for task breakdown or implementation.
---

# Spec-Driven Technical Design Skill

Write a `design.md` document that translates approved requirements into a clear, traceable technical design.

Your job is to produce a design artifact that:
- explains how the requirements will be delivered without turning into an implementation plan
- preserves traceability from design elements to requirements
- reflects existing repository patterns before proposing new structure
- uses valid, minimal Mermaid diagrams that are easy to verify and maintain

Default path: read approved requirements, classify the change, design only the sections that add value, validate the design, save `design.md`, and return a short review-ready summary.

Read `references/design-section-guide.md` when you need help selecting optional sections, keeping diagrams minimal, or correcting weak traceability coverage.

## Shared Protocol

Follow the Context Preflight and Phase Gate protocols in the `spec-driven-shared` skill's `references/shared-protocol.md`.

## Per-Phase Todo List

When this skill begins execution, create a todo list containing the following items in `pending` state. This list is scoped to this phase only — do not carry over items from any previous phase.

1. Read approved requirements.md
2. Read project guidelines
3. Retrieve contextual memory (architecture)
4. Inspect existing codebase patterns
5. Classify change type
6. Design architecture with design elements
7. Save design.md
8. Validate design
9. Audit design (agent-work-auditor)

### Progress Rules

- Mark an item `in_progress` when starting that work step.
- Mark an item `completed` only after the work step has been verified.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when this phase begins; do not append to a prior phase's list.

## Output File

`.specs/changes/<slug>/design.md`

**IMPORTANT:** Only `design.md` is a valid spec document name for design. The spec-driven workflow strictly requires exactly three document types: `requirements.md`, `design.md`, and `tasks.md`.

## Required Document Structure

See the `spec-driven-shared` skill's `references/document-templates.md` for the design document template.

## Change Type Classification

Choose one primary change type and use it to determine depth and section inclusion.

| Change Type | Use When | Design Depth |
|-------------|----------|--------------|
| `new-feature` | Adding new capability | Full architecture plus all relevant optional sections |
| `enhancement` | Extending existing behavior | Focused architecture delta and affected areas |
| `refactoring` | Restructuring without behavior change | Structural design, file movement, dependency impact |
| `bug-fix` | Correcting incorrect behavior | Minimal targeted design of root cause and fix path |
| `performance` | Improving latency, throughput, or resource usage | Bottleneck-focused architecture and impact analysis |
| `infrastructure` | Tooling, CI/CD, deployment, or configuration changes | Operational design and configuration anatomy |
| `documentation` | Docs-only change | Lightweight design focused on affected documentation files |

## Required Sections

These sections must always be present in a full design document:
- `## Overview`
- `## System Architecture`
- `## Code Anatomy`
- `## Repository Context Evidence`
- `## Traceability Matrix`

## Optional Section Rules

Include a section only when it adds design value. Do not add empty placeholders.

| Section | Include When | Skip When |
|---------|--------------|-----------|
| `## Data Flow` | Multi-step processing, transformation, orchestration | Local, structural, or single-step interaction |
| `## Data Models` | Data structures, contracts, state shapes, or schemas added/changed | No meaningful data structure changes |
| `## Error Handling` | New failure modes, recovery paths, or user-visible errors introduced | Existing error behavior unchanged |
| `## Impact Analysis` | Existing features, shared code, contracts, migrations, or operations affected | Change is isolated and additive |

If `## Impact Analysis` is included, include `### Testing Requirements`. Add `### Breaking Changes` only when contracts change, `### Dependencies` only when relevant, `### Risk Assessment` for medium/high-risk changes, and `### Rollback Plan` for deployments/migrations.

## Design Rules

- Use `DES-<number>` identifiers starting at `DES-1`.
- Every design element must have:
  - a `### DES-N: Title` heading
  - a short description of responsibility and boundaries
  - at least one Mermaid diagram
  - an `_Implements: REQ-X.Y_` line
- Every referenced requirement must exist in `requirements.md`.
- Use `## Code Anatomy` to map files/directories to `DES-*`. Existing paths must be verified by `Glob` or `Read`; proposed paths must be labeled `New`.
- Use `## Traceability Matrix` to map every `DES-*` element to requirements.
- Prefer architecture decisions over implementation details.
- Do not include task breakdowns, code patches, or step-by-step instructions.
- Resolve all placeholders before returning output.

## Mermaid Rules

Prefer simple, valid Mermaid over visually rich diagrams.

### Safe Defaults

Prefer diagram types: `flowchart`, `sequenceDiagram`, `classDiagram`, `erDiagram`. Use the simplest diagram type that communicates the design. Keep one primary concern per diagram. Use short labels and clear edge text.

### Avoid Breakage

- Start every diagram with the diagram type declaration on the first non-empty line.
- Avoid advanced directives, frontmatter config, themes, or layout tuning unless necessary.
- Avoid unsupported features, comments inside Mermaid blocks, or unquoted risky labels like `"End"`.
- If syntax is uncertain, simplify the diagram instead of adding more detail.

## Clarification Policy

Ask a clarifying question only if ambiguity would materially change system boundaries, integration design, security posture, data model design, or scaling approach.

### When to Ask
- External integration details are missing
- Security constraints materially affect architecture
- Data persistence or contract shape is unclear
- Scope is too broad for one coherent design document

### When NOT to Ask
- Existing code patterns provide a reasonable default
- Ambiguity is implementation-level rather than architectural

## Validation and Recovery

When `sds validate design` returns errors:
1. Add missing required sections
2. Fix Mermaid syntax by simplifying diagrams first
3. Add missing `DES-*` headings
4. Add or fix `_Implements: REQ-X.Y_` links
5. Ensure all referenced requirements exist

After 3 failed validation attempts:
1. Summarize remaining errors
2. Ask: "Should I proceed with best-effort corrections?"

### Missing Guidelines Fallback

If project guideline files do not exist:
- Infer conventions from nearby code and existing repository structure
- Default to simpler architecture rather than introducing new abstractions
- Record the missing guideline files in `## Repository Context Evidence`

## Auditing Integration

After completing design and before requesting approval, invoke the `agent-work-auditor` skill:

```
Invoke: agent-work-auditor skill
Artifact: .specs/changes/<slug>/design.md
ChangeType: feat
Mode: standard
Extensions: spec-driven
```

The audit verdict (Approve / Request Changes / Approval with Notes) determines whether to proceed to Phase 3.

## Quality Bar (Self-Check)

Before returning the design, verify:
- [ ] Document starts with `# Design Document`
- [ ] `## Overview`, `## System Architecture`, `## Code Anatomy`, `## Repository Context Evidence`, and `## Traceability Matrix` are present
- [ ] Every design element uses `### DES-N: Title`
- [ ] Every design element includes a Mermaid diagram
- [ ] Every design element includes `_Implements: REQ-X.Y_`
- [ ] All requirement references exist in `requirements.md`
- [ ] Mermaid diagrams are simple and syntactically safe
- [ ] No placeholders remain

## Output Requirements

Write `.specs/changes/<slug>/design.md` before requesting review. Keep the design concise but complete enough for task decomposition. Prefer validator-compatible structure over decorative formatting.

## Response Behavior

If enough information is available, produce the full `design.md` content directly.

If material ambiguity blocks a sound design, ask a short clarification first. Do not produce a low-confidence architecture.

## Contextual Stewardship Integration

At the start of this phase, invoke the `contextual-stewardship` skill to retrieve established architectural patterns:

```text
Invoke: contextual-stewardship skill
Action: retrieve
Query: architecture
```

## Things To Avoid

- Creating additional files in `.specs/changes/<slug>/`. Only write design.md for this phase.
