# Spec-Driven Development Project

This project uses **Spec-Driven Development (SDD)** methodology enforced by the Spec-Driven Steroids toolkit.

## Workflow Overview

All feature development follows this rigorous flow:

```
Requirements (EARS) → Technical Design (Mermaid) → Atomic Tasks → Implementation
```

**Phase Gatekeeper:** You cannot skip phases. Every phase requires human approval before proceeding.

## Available Skills

Use these skills to guide your work:

### Workflow Orchestration
- `/spec-driven` - Full end-to-end Spec-Driven Development workflow
- `/inject-guidelines` - Generate project documentation (AGENTS.md, CONTRIBUTING.md, etc.)

### Individual Phase Skills
- `/spec-driven-requirements-writer` - Write EARS-format requirements
- `/spec-driven-technical-designer` - Create technical designs with Mermaid diagrams
- `/spec-driven-task-decomposer` - Break designs into atomic implementation tasks
- `/spec-driven-task-implementer` - Implement with full traceability

### Utilities
- `/project-guidelines-writer` - Core skill for generating individual guideline documents

## Spec Folder Convention

All specs are stored in:
```
specs/changes/<slug>/
├── requirements.md  # EARS-format requirements
├── design.md        # Technical design with Mermaid diagrams
└── tasks.md         # Atomic implementation tasks
```

## MCP Validation Tools

You have access to MCP validation tools:

- `verify_requirements_file` - Validate EARS syntax and REQ-X IDs
- `verify_design_file` - Validate Mermaid diagrams and DES-X traceability
- `verify_tasks_file` - Validate task structure and traceability
- `verify_complete_spec` - Cross-file validation for complete workflow

**Always validate artifacts before presenting them to the user.**

## Implementation Rules

1. **Never skip phases** - Even if the user asks to "just implement", start with requirements
2. **Validate everything** - Use MCP tools after writing each artifact
3. **Maintain traceability** - Every DES-X links to REQ-X, every task links to DES-X
4. **Update task status** - Mark tasks `[~]` when starting, `[x]` when done
5. **Reference IDs in commits** - Every commit should mention REQ-X and DES-X IDs

## Before Starting Any Feature

1. **Generate Project Guidelines First (Recommended)**:
   - If AGENTS.md, CONTRIBUTING.md, or STYLEGUIDE.md don't exist, use `/inject-guidelines`
   - This ensures you understand project conventions before writing specs
   - Only needs to be done once per project

2. **Check for existing specs**:
   - Check if `specs/changes/<slug>/requirements.md` exists
   - If no requirements exist, start with Phase 1 (Requirements)

3. **Follow the phase gatekeeper**:
   - Always ask for human approval between phases
   - Write artifacts first, then request approval

## EARS Patterns Reference

| Pattern | Syntax | Use When |
|---------|--------|----------|
| Ubiquitous | THE system SHALL \<action\> | Always applies |
| Event-driven | WHEN \<trigger\>, THE system SHALL \<action\> | Triggered by event |
| State-driven | WHILE \<state\>, THE system SHALL \<action\> | During a state |
| Optional | WHERE \<feature\> is enabled, THE system SHALL \<action\> | Feature-gated |
| Unwanted | IF \<error condition\>, THEN THE system SHALL \<recovery\> | Error handling |

## Project Guidelines

If these files exist, read them before starting work:

- @AGENTS.md - AI agent runtime guidance and build commands
- @CONTRIBUTING.md - Git workflow and PR expectations
- @STYLEGUIDE.md - Code conventions and patterns
- @TESTING.md - Testing strategy and patterns
- @ARCHITECTURE.md - System architecture overview
- @SECURITY.md - Security practices

Use `/project-guidelines-writer` to generate these if they don't exist.

## Key Principles

- **Rigorous > Fast** - Correctness over speed
- **Traceable > Clever** - Every decision must trace back to requirements
- **Validated > Assumed** - Use MCP tools to verify correctness
- **Explicit > Implicit** - Document assumptions and decisions
