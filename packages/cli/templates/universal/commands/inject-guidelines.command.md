---
description: Review repository guidelines using the project-guidelines-writer skill. Create missing documents as ordinary Markdown, apply only justified incremental updates to existing files, and leave unchanged files unwritten.
---

Load the `project-guidelines-writer` skill. Analyze this repository and maintain its guideline documents as ordinary, tool-independent Markdown.

## Workflow

### Step 1: Repository Analysis

- Read existing guideline files in full before proposing changes.
- Select representative files across config, source, docs, and tests.
- Do not use historical spec artifacts as current repository evidence.
- Keep analysis notes internal unless the user requests them.

### Step 2: Repository Insights

- Analyze the selected files for stack, structure, conventions, documentation coverage, and conflicts.
- Confirm commands, paths, versions, and prerequisites against current configuration, scripts, CI, and code.
- Determine whether the repository's testing strategy is clear or mixed.
- When no documented testing strategy exists and evidence is unclear or mixed, default generated `TESTING.md` to Testing Trophy guidance.
- Under that fallback, prefer integration tests as the main confidence layer, e2e tests for critical user journeys, and unit tests as secondary and selective.
- Do not replace an existing documented testing strategy merely to apply this fallback.

### Step 3: Delta Review

- Identify only necessary corrections, material gaps, harmful contradictions, legacy marker removal, or changes explicitly requested by the user.
- Justify each proposed delta with repository evidence or the user's request.
- Preserve valid content, structure, wording, and formatting.
- Do not reorganize or restyle valid documents merely to match a template.
- Preserve explicit project policies; ask before changing them when the intended policy is unclear.
- Create missing guideline files automatically unless explicitly skipped by the user.
- Do not treat missing guideline files as optional.

### Step 4: Document Generation And Writing

- Review these six documents and create any missing ones unless explicitly skipped:
  - `AGENTS.md`
  - `CONTRIBUTING.md`
  - `STYLEGUIDE.md`
  - `TESTING.md`
  - `ARCHITECTURE.md`
  - `SECURITY.md`
- Use the skill's Document Responsibility Matrix to organize new content, not to force rewrites of existing documents.
- Use targeted patches for existing files; never regenerate them by default.
- If no justified changes remain, do not write the file.
- Re-read changed files and inspect the diff for unrelated edits or lost guidance.
- Summarize created, updated, unchanged, and explicitly skipped files, with the reasons for applied deltas.

## Key Behaviors

- Review all six guideline documents by default unless the user explicitly skips named files.
- Do not add generator branding, ownership markers, or tool-specific maintenance instructions.
- Remove only legacy SpecDriven:managed delimiter comments; preserve all enclosed content.
- Marker removal is a targeted migration, not permission to regenerate the document or remove unrelated comments.
- Replace obsolete generator-only maintenance instructions with ordinary editing guidance; preserve tools and workflows that belong to the project itself.
- Cross-reference related docs instead of duplicating guidance.
- Keep behavior aligned with the `project-guidelines-writer` skill rather than adding platform-specific workflow rules.

## Constraints

- Do not generate feature specs or implementation code.
- Do not introduce tool-specific workflows into guidelines unless they describe the repository itself.
- Do not ask for confirmation between internal analysis steps.
- Ask only for unresolved material policy conflicts or before a necessary whole-file rewrite not explicitly requested by the user.
