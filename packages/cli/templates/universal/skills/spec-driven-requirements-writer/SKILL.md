---
name: spec-driven-requirements-writer
description: Specialized agent for writing EARS-format requirements documents.
---

# Spec-Driven Requirements Writer Skill

Write a `requirements.md` document using concise, testable, EARS-syntax requirements.

Your job is to produce a clean requirements artifact that:
- defines the user/business need clearly
- avoids design and implementation details
- gives downstream design and task generation enough structure to work reliably
- preserves traceability through stable requirement IDs

## Process

1. **Read Project Guidelines** (if they exist):
   - Use `Glob` to find `AGENTS.md`, `STYLEGUIDE.md`, `ARCHITECTURE.md`
   - Use `Read` to understand existing patterns, naming conventions, and architecture
   - Use `Grep` to search for keywords or patterns relevant to the feature
2. Analyze user description and any issue context
3. Extract actors, actions, and constraints
4. Write requirements using valid EARS syntax
5. Define glossary terms if domain-specific terminology is needed
6. **Validate**: Call `mcp:verify_requirements_file` to ensure compliance
7. **Write Before Review**: Save to `specs/changes/<slug>/requirements.md` before asking for approval

## Output File

`specs/changes/<slug>/requirements.md`

## Required Document Structure

```markdown
# Requirements

## Overview
<1-3 short paragraphs describing the problem, user value, and scope>

## Glossary
| Term | Definition |
|------|------------|
| <Term> | <Clear, unambiguous definition> |

## Assumptions
- <assumption 1>
- <assumption 2>

## Requirements

### REQ-1: <short requirement title>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria
1.1 WHEN <trigger>, THEN the <system name> SHALL <response>.
1.2 IF <undesired condition>, THEN the <system name> SHALL <response>.

### REQ-2: <short requirement title>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria
2.1 THE <system name> SHALL <response>.
2.2 WHILE <precondition>, the <system name> SHALL <response>.
```

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

- Every acceptance criterion must use uppercase EARS keywords exactly as shown in the allowed patterns.
- Every acceptance criterion must use exactly one valid EARS pattern (or a valid complex combination).
- Every acceptance criterion must include a named system subject (e.g., `the application`, `the auth service`, `the product catalog`).
- Every acceptance criterion must include exactly one `shall`.
- Every acceptance criterion must be a single sentence.
- Clauses must appear in canonical order: `WHILE` → `WHEN`/`WHERE`/`IF` → `THEN` when applicable → `the <system>` → `SHALL` → `<response>`.

### Invalid Forms (Avoid These)

Do not write:

- `The system should ...` (use `SHALL`)
- `The system must be able to ...` (weak, vague)
- `When X, the user can ...` (not a system requirement)
- `If X, the system should ...` (use `SHALL`)
- `When X then ...` (missing system subject)
- `The system shall, when X, ...` (non-canonical clause order)
- `shall support`, `shall handle`, `shall allow`, `shall manage` (vague verbs)

### Strong Verbs

Prefer observable, testable verbs:

- `display`, `show`, `hide`
- `create`, `delete`, `update`, `store`
- `validate`, `reject`, `accept`
- `send`, `receive`, `notify`
- `calculate`, `compute`, `determine`
- `log`, `record`, `track`
- `prevent`, `block`, `allow`
- `require`, `enforce`

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
- accessibility requirements when they affect observable behavior
- performance requirements only if explicitly requested or clearly necessary

### Exclude

- implementation steps
- code-level details
- class/module/package structure
- database schema design
- internal algorithms unless externally observable
- test plans or test cases
- task breakdowns

## Output Rules

- Use `REQ-<number>` identifiers in ascending order starting at `REQ-1`.
- Give each requirement a short, specific title.
- Every requirement must include exactly one user story in `As a <role>, I want <capability>, so that <benefit>` format.
- Number acceptance criteria as `<requirement-number>.<criterion-number>` (e.g., `1.1`, `1.2`, `2.1`).
- Each acceptance criterion must be testable and use valid EARS syntax.
- Keep requirements implementation-agnostic.
- Resolve all placeholders before returning output.
- Do not include editorial comments, HTML comments, TODO markers, or drafting notes.
- Include `## Glossary` only if domain-specific terms need definition.
- Include `## Assumptions` only if assumptions materially affect scope or interpretation.

## Clarification Policy

Ask a clarifying question only if the ambiguity would materially change one or more of:

- scope
- user roles
- required behavior
- success criteria
- compliance/security posture

### When to Ask

- No clear user role or stakeholder
- No discernible goal or outcome
- Conflicting or contradictory requirements
- Scope is too broad to fit one requirements document

### When NOT to Ask

- The request contains enough context to write meaningful requirements
- Reasonable assumptions can be made
- The ambiguity is about implementation details (not requirements)
- The user provided examples or references

Instead: proceed with reasonable assumptions and document them in `## Assumptions`.

### How to Ask

- Present no more than 3 focused questions at a time
- Make each question specific and actionable
- Prefer multiple-choice when possible
- Allow the user to skip questions

## Validation and Error Recovery

### MCP Validation Failures

When `mcp:verify_requirements_file` returns errors:

1. Fix missing or invalid sections
2. Rewrite acceptance criteria with correct EARS syntax
3. Add or correct `REQ-*` numbering
4. Add or correct acceptance criterion numbering
5. Remove empty sections or add meaningful content

After 3 failed validation attempts:

1. Present all errors in a summary
2. Ask: "Should I proceed with best-effort corrections?"
3. If yes: make corrections, document assumptions in `## Assumptions`, proceed
4. If no: request specific guidance

### Corrupted Files

If `requirements.md` is corrupted:

1. Read existing content to salvage valid portions
2. Identify recoverable requirements
3. Rewrite invalid sections with correct EARS syntax
4. Re-validate
5. Document what was recovered vs rewritten

## Quality Bar (Self-Check)

Before returning the requirements, verify:

- [ ] Document starts with `# Requirements`
- [ ] Each requirement uses `### REQ-N: Title` format
- [ ] Each requirement has exactly one user story
- [ ] Each acceptance criterion uses valid EARS syntax
- [ ] Each acceptance criterion includes a named system subject
- [ ] Each acceptance criterion includes exactly one `shall`
- [ ] Acceptance criterion numbering matches its parent requirement
- [ ] No placeholders remain
- [ ] No design or implementation details present
- [ ] No `should`, `may`, `might`, or `can` in acceptance criteria
- [ ] No vague verbs (`support`, `handle`, `manage`, `be able to`)

## Response Behavior

If enough information is available, produce the full `requirements.md` content directly.

If material ambiguity blocks a good requirements document, ask a short clarification first. Do not draft low-confidence requirements.
