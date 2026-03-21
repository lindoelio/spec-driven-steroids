---
name: Inject-Guidelines
description: Generate or update AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, and SECURITY.md.
---

# Inject Guidelines Workflow

Analyze the repository and generate or update the standard guideline documents with a consistent, low-friction workflow.

## Workflow

### Step 1: Repository Analysis

- Invoke the `project-guidelines-writer` skill.
- Inspect existing guideline files first to avoid duplication.
- Select 10-30 representative files across config, source, docs, and tests.
- Return the repository-analysis output expected by the skill.

### Step 2: Repository Insights

- Invoke the `project-guidelines-writer` skill.
- Analyze the selected files for stack, structure, conventions, documentation coverage, and conflicts.
- Determine whether the repository's testing strategy is clear or mixed.
- If testing strategy is unclear or mixed, default generated `TESTING.md` to Testing Trophy guidance.
- Under that fallback, prefer integration tests as the main confidence layer, e2e tests for critical user journeys, and unit tests as secondary and selective.
- Return the repository-insights output expected by the skill.

### Step 3: Existing Files Decision

- Ask the user how to handle each existing guideline file:
  - Overwrite
  - Skip
  - Update managed sections only
- Missing guideline files must be created automatically.
- Do not treat missing guideline files as optional.

### Step 4: Document Generation And Writing

- Invoke the `project-guidelines-writer` skill.
- Generate these six documents by default:
  - `AGENTS.md`
  - `CONTRIBUTING.md`
  - `STYLEGUIDE.md`
  - `TESTING.md`
  - `ARCHITECTURE.md`
  - `SECURITY.md`
- Use the Document Responsibility Matrix from the skill.
- Preserve user-authored content outside managed sections when updating.
- Write the files before asking the user to review the result.

## Key Behaviors

- Generate all six guideline documents by default unless the user explicitly skips named files.
- Use managed section markers for generated content.
- Cross-reference related docs instead of duplicating guidance.
- Keep behavior aligned with the `project-guidelines-writer` skill rather than adding platform-specific workflow rules.

## Constraints

- Do not generate feature specs or implementation code.
- Do not ask for confirmation between internal analysis steps.
- Ask only when user choice is required for existing-file handling.
