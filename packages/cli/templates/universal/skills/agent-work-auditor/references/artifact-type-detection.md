# Artifact Type Detection

Detect what type of artifact is being audited.

## Artifact Types

### code

Implementation files, modules, functions, scripts.

Detected by:
- File extensions: `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.go`, `.rs`, `.java`, etc.
- File patterns: `src/`, `lib/`, `app/`, `cmd/`, `internal/`
- Content: function declarations, class definitions, import statements

### specification

Requirements documents, user stories, acceptance criteria.

Detected by:
- File names: `requirements.md`, `spec.md`, `user-stories.md`
- Content: EARS patterns, "shall/must" keywords, acceptance criteria
- Path patterns: `.specs/`, `requirements/`

### design

Architecture documents, technical specifications, diagrams.

Detected by:
- File names: `design.md`, `architecture.md`, `ADR.md`
- Content: Mermaid diagrams, DES-* IDs, component descriptions
- Path patterns: `docs/design/`, `architecture/`

### tasks

Implementation plans, task breakdowns, todo lists.

Detected by:
- File names: `tasks.md`, `plan.md`, `todo.md`, `implementation.md`
- Content: Task checkboxes, phase headers, `_Implements:` links
- Path patterns: `.specs/changes/*/tasks.md`

### mixed

Multiple artifact types in one audit (e.g., PR containing code + tests + docs).

Detected when:
- Multiple file types in the audit scope
- No single type dominates

## Detection Heuristics

1. **File extension analysis**: Primary indicator for code artifacts
2. **File name patterns**: Strong indicator for spec/design/task documents
3. **Content patterns**: Cross-reference with file extension
4. **Path context**: Directory structure provides context

## Decision Logic

```
IF files are all code extensions → artifactType = code
ELIF files match spec patterns → artifactType = specification
ELIF files match design patterns → artifactType = design
ELIF files match task patterns → artifactType = tasks
ELIF multiple types present → artifactType = mixed
ELSE → artifactType = mixed (conservative default)
```