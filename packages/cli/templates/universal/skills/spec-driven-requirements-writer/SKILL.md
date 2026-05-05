---
name: spec-driven-requirements-writer
description: Use this skill when the user wants to start Phase 1 of a Spec-Driven change, define behavior, or turn a feature idea into a requirements.md file. It writes EARS-format requirements, validates them, and should not be used for design, task breakdown, or implementation.
---

# Spec-Driven Requirements Writer Skill

Write a `requirements.md` document using concise, testable, EARS-syntax requirements.

Your job is to produce a clean requirements artifact that:
- defines the user/business need clearly
- avoids design and implementation details
- gives downstream design and task generation enough structure to work reliably
- preserves traceability through stable requirement IDs

Default path: analyze the request, extract actors and constraints, write concise EARS requirements, validate them, save `requirements.md`, and return a short review-ready summary.

Read `references/requirements-patterns.md` when you need example EARS phrasing, stronger observable verbs, or recovery examples for invalid requirement wording.

## Shared Protocol

Follow the Context Preflight and Phase Gate protocols in the `spec-driven-shared` skill's `references/shared-protocol.md`.

## Per-Phase Todo List

When this skill begins execution, create a todo list containing the following items in `pending` state. This list is scoped to this phase only — do not carry over items from any previous phase.

1. Read project guidelines
2. Retrieve contextual memory (business)
3. Analyze user description and context
4. Extract actors, actions, and constraints
5. Write EARS requirements
6. Save requirements.md
7. Validate requirements
8. Audit requirements (agent-work-auditor)

### Progress Rules

- Mark an item `in_progress` when starting that work step.
- Mark an item `completed` only after the work step has been verified.
- Do not mark an item `completed` until verification passes.
- Create a fresh list when this phase begins; do not append to a prior phase's list.

## Output File

`.specs/changes/<slug>/requirements.md`

**IMPORTANT:** Only `requirements.md` is a valid spec document name for requirements. The spec-driven workflow strictly requires exactly three document types: `requirements.md`, `design.md`, and `tasks.md`.

## Required Document Structure

See the `spec-driven-shared` skill's `references/document-templates.md` for the requirements document template.

## EARS Syntax (Canonical)

EARS requirements follow a strict clause order and must include a named system subject.

### Generic Form

```
WHILE <optional precondition>, WHEN <optional trigger>, the <system name> SHALL <system response>.
```

### Allowed Patterns

| Pattern | Syntax | Use When |
|---------|--------|----------|
| Ubiquitous | `THE <system name> SHALL <response>.` | Always active, no conditions |
| State-driven | `WHILE <precondition>, the <system name> SHALL <response>.` | Active during a specific state |
| Event-driven | `WHEN <trigger>, THEN the <system name> SHALL <response>.` | Triggered by an event |
| Optional feature | `WHERE <feature condition>, the <system name> SHALL <response>.` | Feature-gated behavior |
| Unwanted behavior | `IF <undesired condition>, THEN the <system name> SHALL <response>.` | Error handling, recovery |
| Complex | `WHILE <precondition>, WHEN <trigger>, THEN the <system name> SHALL <response>.` | Combined conditions |

### Rules

- Every acceptance criterion must use uppercase EARS keywords exactly as shown.
- Every acceptance criterion must use exactly one valid EARS pattern.
- Every acceptance criterion must include a named system subject.
- Every acceptance criterion must include exactly one `shall`.
- Every acceptance criterion must be a single sentence.
- Clauses must appear in canonical order.

### Invalid Forms (Avoid These)

Do not write:
- `The system should ...` (use `SHALL`)
- `The system must be able to ...` (weak, vague)
- `When X, the user can ...` (not a system requirement)
- `shall support`, `shall handle`, `shall allow`, `shall manage` (vague verbs)

### Strong Verbs

Prefer observable, testable verbs:
- `display`, `create`, `delete`, `update`, `store`
- `validate`, `reject`, `accept`
- `send`, `receive`, `notify`
- `log`, `record`, `track`
- `prevent`, `block`, `require`, `enforce`

Avoid weak verbs:
- `support`, `handle`, `manage`
- `be able to`, `have the ability to`
- `provide`, `offer` (without specific behavior)

## Scope Rules

### Include
- user-visible behavior
- business rules
- validation and error handling expectations
- security and privacy requirements when they affect observable behavior

### Exclude
- implementation steps
- code-level details
- class/module/package structure
- database schema design
- internal algorithms unless externally observable
- test plans or test cases

## Output Rules

- Use `REQ-<number>` identifiers starting at `REQ-1`.
- Give each requirement a short, specific title.
- Every requirement must include exactly one user story in `As a <role>, I want <capability>, so that <benefit>` format.
- Number acceptance criteria as `<requirement-number>.<criterion-number>` (e.g., `1.1`, `1.2`).
- Each acceptance criterion must be testable and use valid EARS syntax.
- Resolve all placeholders before returning output.
- Do not include editorial comments, HTML comments, TODO markers, or drafting notes.
- Include `## Glossary` only if domain-specific terms need definition.
- Include `## Assumptions` only if assumptions materially affect scope or interpretation.

## Clarification Policy

Ask a clarifying question only if the ambiguity would materially change scope, user roles, required behavior, success criteria, or compliance/security posture.

### When to Ask
- No clear user role or stakeholder
- No discernible goal or outcome
- Conflicting or contradictory requirements

### When NOT to Ask
- The request contains enough context to write meaningful requirements
- Reasonable assumptions can be made

## Validation and Error Recovery

When `sds validate requirements` returns errors:

1. Fix missing or invalid sections
2. Rewrite acceptance criteria with correct EARS syntax
3. Add or correct `REQ-*` numbering

After 3 failed validation attempts:
1. Present all errors in a summary
2. Ask: "Should I proceed with best-effort corrections?"
3. If yes: make corrections, document assumptions in `## Assumptions`, proceed

## Auditing Integration

After completing requirements and before requesting approval, invoke the `agent-work-auditor` skill:

```
Invoke: agent-work-auditor skill
Artifact: .specs/changes/<slug>/requirements.md
ChangeType: feat
Mode: standard
Extensions: spec-driven
```

The audit verdict (Approve / Request Changes / Approval with Notes) determines whether to proceed to Phase 2.

## Quality Bar (Self-Check)

Before returning the requirements, verify:
- [ ] Document starts with `# Requirements`
- [ ] Each requirement uses `### REQ-N: Title` format
- [ ] Each requirement has exactly one user story
- [ ] Each acceptance criterion uses valid EARS syntax
- [ ] Each acceptance criterion includes a named system subject
- [ ] Each acceptance criterion includes exactly one `shall`
- [ ] No placeholders remain
- [ ] No design or implementation details present
- [ ] No vague verbs in acceptance criteria

## Response Behavior

If enough information is available, produce the full `requirements.md` content directly.

If material ambiguity blocks a good requirements document, ask a short clarification first. Do not draft low-confidence requirements.

## Contextual Stewardship Integration

At the start of this phase, invoke the `contextual-stewardship` skill to retrieve established business and domain rules:

```text
Invoke: contextual-stewardship skill
Action: retrieve
Query: business
```

## Quality Grading Integration

After completing requirements and before requesting approval, invoke the `quality-grading` skill:

```
Invoke: quality-grading skill
Artifact: .specs/changes/<slug>/requirements.md
Mode: grade-and-fix
```

The quality-grading skill will auto-fix issues scoring below 4.

## Things To Avoid

- Creating additional files in `.specs/changes/<slug>/`. Only write requirements.md for this phase.
