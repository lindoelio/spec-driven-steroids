---
name: project-guidelines-writer
description: Use this skill when the user wants repository guidance documents generated or refreshed, including AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, and SECURITY.md. It analyzes the repository, generates all six guideline files by default, prefers managed-section updates for existing files, and should not be used for feature specs or implementation.
---

# Project Guidelines Writer Skill

Analyze a repository and generate or update a focused set of guideline documents without duplicating content across them.

Your job is to:
- understand the repository from a representative sample of files
- detect conventions, architecture, testing posture, and documentation gaps
- generate the standard guideline set with clear document boundaries
- preserve user-authored content outside managed sections when updating existing files

Default path: analyze the repository, infer conventions from representative files, create missing guideline files, update existing files through managed sections by default, and ask only when overwrite or skip decisions are truly needed.

## Standard Outputs

By default, generate these six documents:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `STYLEGUIDE.md`
- `TESTING.md`
- `ARCHITECTURE.md`
- `SECURITY.md`

Missing files should be created automatically. Existing files should only be skipped when the user explicitly chooses to skip them.

## Workflow

### Step 1: Repository Analysis

Select the files needed to understand the repository.

1. Read any existing guideline files first:
   - `AGENTS.md`
   - `CONTRIBUTING.md`
   - `STYLEGUIDE.md`
   - `TESTING.md`
   - `ARCHITECTURE.md`
   - `SECURITY.md`
2. Select representative files across:
   - configuration
   - entry points
   - source code
   - tests and test config
   - existing docs
3. Prefer files that reveal structure, conventions, and workflows.

Use tools like:

- `Glob` to find representative files
- `Read` to inspect them
- `Grep` to confirm naming, test, and architecture patterns

**Output**: return the repository-analysis output expected by the caller.

### Step 2: Repository Insights

Analyze the selected files and produce a repository insights object covering:

1. technology stack
2. package manager and tooling
3. code and naming conventions
4. architectural patterns
5. testing patterns and consistency
6. existing documentation coverage
7. conflicts between docs and code
8. high-level project structure

### Testing Strategy Defaulting Rule

If repository evidence shows the testing strategy is inconsistent, unclear, or mixed, generated `TESTING.md` should default to **Testing Trophy** guidance:

- integration tests as the main confidence layer
- e2e tests for critical user journeys and cross-system flows
- unit tests as secondary and selective for isolated, high-risk logic

**Output**: return the repository-insights output expected by the caller.

### Step 3: Existing Files Decision

Before writing guideline files, determine how to handle existing ones.

For each existing guideline file, ask the user whether to:

- overwrite the whole file
- skip it
- update managed sections only

Rules:

- missing guideline files must be created automatically
- do not treat missing guideline files as optional
- preserve user-authored content outside managed sections when updating

### Step 4: Document Generation And Writing

Generate and write each target document before asking the user to review the result.

For each document:

1. use the repository insights and existing-file decision
2. apply the Document Responsibility Matrix
3. keep content focused on that document's responsibility
4. cross-reference other guideline files instead of duplicating content
5. wrap generated content in managed section markers when applicable
6. write the file to the repository

## Managed Sections

Use these markers for generated content:

```markdown
<!-- SpecDriven:managed:start -->
... generated content ...
<!-- SpecDriven:managed:end -->
```

When updating existing files:

- preserve user-authored content outside managed sections
- update only the managed section when the user chooses managed-section updates
- if managed markers do not exist and a managed update is requested, add a managed section without deleting user content outside it

## Document Responsibility Matrix

| Document | Must Contain | Must Not Contain |
|----------|--------------|------------------|
| `AGENTS.md` | AI persona, technology stack summary, build/lint/test commands, agent constraints, code comment policy | detailed code conventions, testing patterns, architecture diagrams |
| `CONTRIBUTING.md` | git workflow, PR process, repo structure, documentation workflow | build commands, naming conventions, testing strategy |
| `STYLEGUIDE.md` | naming conventions, code style, language/framework patterns | architecture decisions, security rules, testing strategy |
| `TESTING.md` | testing strategy, frameworks, test organization, project-specific testing notes | general code conventions, build commands |
| `ARCHITECTURE.md` | high-level architecture, system boundaries, Mermaid diagrams, architecture decisions | detailed file-level coding rules, testing details, PR process |
| `SECURITY.md` | security policy, reporting process, security constraints and practices | general architecture, git workflow |

## Document Mapping Rules

Use these defaults when deciding where content belongs:

- detailed naming and code style -> `STYLEGUIDE.md`
- testing strategy and examples -> `TESTING.md`
- security requirements and policies -> `SECURITY.md`
- system structure and diagrams -> `ARCHITECTURE.md`
- workflow and review process -> `CONTRIBUTING.md`
- agent behavior, commands, and high-level repo context -> `AGENTS.md`

When generating `AGENTS.md`, always include this constraint under agent guidance:

- add code comments only when they are highly necessary to explain non-obvious intent, workarounds, or critical constraints

## Output Format

When the caller expects generated document output, use:

```xml
<summary>
Brief summary of generated content.
</summary>
<document>
# Document Title
... content ...
</document>
```

Start directly with the XML wrapper when XML output is required.

## Quality Bar

Before considering the work complete, verify:

- [ ] all required target documents were handled
- [ ] missing guideline files were created unless explicitly skipped by the user
- [ ] document boundaries follow the Responsibility Matrix
- [ ] overlapping guidance was moved or cross-referenced instead of duplicated
- [ ] managed section markers are correct where used
- [ ] user-authored content outside managed sections was preserved
- [ ] Testing Trophy fallback was applied when testing strategy evidence was mixed or unclear
- [ ] generated guidance reflects the actual repository rather than generic boilerplate

## Recovery Rules

### Limited Repository Evidence

If there are too few representative files or the repository is sparse:

1. proceed with the best available evidence
2. use conservative defaults
3. keep the generated guidance minimal and explicit
4. note important limitations in the generated content or summary using ordinary prose, not HTML comments

### Conflicts Between Docs And Code

If existing docs conflict with repository reality:

1. prefer current repository evidence over stale documentation
2. surface the conflict clearly
3. update the affected document when the intended correction is reasonably clear
4. ask the user only if the conflict materially changes repository policy or workflow

### Responsibility Violations

If content belongs in a different guideline file:

1. move it to the correct document
2. replace duplication with a short cross-reference
3. keep each file focused on its responsibility

## Response Behavior

Do not ask for confirmation between internal analysis steps.

Ask the user only when:

- an existing guideline file needs an overwrite/skip/managed-update decision
- a material repository-policy conflict cannot be safely resolved from repository evidence

Otherwise, proceed through analysis, insights, and document generation directly.
