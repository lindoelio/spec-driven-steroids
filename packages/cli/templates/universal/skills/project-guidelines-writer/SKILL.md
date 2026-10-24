---
name: project-guidelines-writer
description: Use this skill when the user wants repository guidance documents generated or refreshed, including AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, and SECURITY.md. It reviews all six documents by default, creates missing files as tool-independent Markdown, applies only justified incremental updates, and leaves unchanged files unwritten. Do not use it for feature specs or implementation.
---

# Project Guidelines Writer Skill

Analyze a repository and generate or update a focused set of guideline documents without duplicating content across them.

Your job is to:
- understand the repository from a representative sample of files
- detect conventions, architecture, testing posture, and documentation gaps
- create missing guidelines with clear document boundaries
- preserve valid existing guidance and apply only necessary, evidence-backed deltas

Default path: read existing guidelines, investigate current repository evidence, create missing documents, patch only justified deltas, and leave unchanged files unwritten. Documents belong to the repository, not to their generator.

## Standard Outputs

Review all six guideline documents by default unless the user explicitly skips named files.

- `AGENTS.md`
- `CONTRIBUTING.md`
- `STYLEGUIDE.md`
- `TESTING.md`
- `ARCHITECTURE.md`
- `SECURITY.md`

Missing files should be created automatically unless explicitly skipped. Reviewing an existing file and finding no necessary changes is a successful outcome, not a skipped file.

## Workflow

### Step 1: Repository Analysis

Select the files needed to understand the repository.

1. Read any existing guideline files in full before proposing changes:
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
4. Exclude historical `.specs/changes/<slug>/` artifacts from repository discovery unless the user explicitly requests analysis of a specific artifact. They are not evidence of current behavior.

Use tools like:

- `Glob` to find representative files
- `Read` to inspect them
- `Grep` to confirm naming, test, and architecture patterns

Keep concise internal notes of the existing guidelines and relevant evidence sources; do not create an extra analysis artifact or stop for confirmation.

### Step 2: Repository Insights

Analyze the selected files for:

1. technology stack
2. package manager and tooling
3. code and naming conventions
4. architectural patterns
5. testing patterns and consistency
6. existing documentation coverage
7. conflicts between docs and code
8. high-level project structure

Confirm commands, paths, versions, and prerequisites against current manifests, configuration, scripts, CI, and code before adding or changing them. Distinguish explicit project policies from patterns merely observed in the sample; do not turn an inference into a mandatory rule.

### Testing Strategy Defaulting Rule

When creating `TESTING.md` or filling a material strategy gap, use **Testing Trophy** guidance if no documented strategy exists and repository evidence is inconsistent, unclear, or mixed:

- integration tests as the main confidence layer
- e2e tests for critical user journeys and cross-system flows
- unit tests as secondary and selective for isolated, high-risk logic

Do not replace an existing documented testing strategy merely to apply this fallback.

### Step 3: Delta Review

Before writing, classify each target as create, update, unchanged, or explicitly skipped.

Each proposed delta must identify the affected passage, current repository evidence or explicit user request, and why the change is necessary.

Justified changes are limited to:

- correcting verified factual inaccuracies
- filling material gaps that affect development, testing, operation, or safety
- resolving harmful contradictions or duplication
- removing legacy generator metadata
- implementing an explicit user request

Rules:

- Create missing guideline files automatically unless explicitly skipped by the user.
- do not treat missing guideline files as optional
- Preserve valid content, structure, wording, and formatting.
- Do not rewrite an existing document merely to match this skill's template or Responsibility Matrix.
- Missing generic boilerplate, stylistic preferences, and a different section order are not sufficient reasons to edit.
- Preserve explicit project policies; ask before changing them when the intended policy is unclear.
- Do not routinely ask for overwrite or skip decisions; honor named skips and request approval only if a necessary whole-file rewrite was not explicitly requested.

### Step 4: Document Generation And Writing

Create missing documents and patch existing ones only after reviewing the proposed deltas.

For each document:

1. use the repository evidence and delta review
2. organize new content with the Document Responsibility Matrix without forcing existing files into its shape
3. cross-reference relevant existing guidance instead of adding duplication
4. Use targeted patches for existing files; never regenerate them by default.
5. If no justified changes remain, do not write the file.
6. re-read changed files and inspect the diff; every changed passage must correspond to a justified delta

Do not touch unchanged files through no-op writes, add generation timestamps, or make cosmetic edits to manufacture an update. Summarize created, updated, unchanged, and explicitly skipped files, with a brief reason for each applied delta.

## Tool-Independent Documents

- Write ordinary Markdown that can be maintained manually or with any other tool.
- Do not add generator branding, ownership markers, or tool-specific maintenance instructions.
- Mention tools and workflows only when they describe the repository itself, not the generator's identity or preferred lifecycle.

For legacy documents:

- Remove only legacy SpecDriven:managed delimiter comments; preserve all enclosed content.
- This applies to actual wrapper comments, not examples quoting them. Preserve unrelated HTML comments.
- Treat all existing content equally, whether previously inside or outside those delimiters; do not assume generated text is disposable.
- Marker removal alone is a justified delta, not permission to regenerate the file. Any other edit requires its own justification.
- Replace obsolete generator-only maintenance instructions with ordinary editing guidance; preserve tools and workflows that belong to the project itself.

## Document Responsibility Matrix

Use this matrix for new documents and additions. Existing valid content does not need to be moved merely to match it.

| Document | Primary Responsibility | Keep Elsewhere By Default |
|----------|--------------|------------------|
| `AGENTS.md` | repository context, technology stack summary, build/lint/test commands, agent constraints, code comment policy | detailed code conventions, testing patterns, architecture diagrams |
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

When creating `AGENTS.md`, include:

1. The code comments constraint under agent guidance:
   - add code comments only when they are highly necessary to explain non-obvious intent, workarounds, or critical constraints

2. The Behavioral Guidelines section (see below) inserted after "Agent Constraints"

3. The Mandatory Self-Review Gate section (see below) inserted immediately after Behavioral Guidelines

When updating an existing AGENTS.md, preserve equivalent guidance instead of inserting the example verbatim.

Preserve established repository-specific workflow and artifact-access rules. Do not introduce Spec-Driven workflows or artifact-access rules merely because this skill is installed.

## Behavioral Guidelines Specification

For a new `AGENTS.md`, use this Behavioral Guidelines section after "Agent Constraints". It is not a mandatory replacement for existing guidance:

```markdown
## Behavioral Guidelines

1. Think Before Coding. Don't assume. Don't hide confusion. Surface tradeoffs.
2. Simplicity First. Minimum code that solves the problem. Nothing speculative. Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
3. Surgical Changes. Touch only what you must. Clean up only your own mess.
4. Goal-Driven Execution. Strong success criteria let you loop independently. Weak criteria ("make it work") require clarification.
```

## Mandatory Self-Review Gate Specification

For a new `AGENTS.md`, include this section immediately after Behavioral Guidelines. It is not a mandatory replacement for equivalent existing guidance:

```markdown
## Mandatory Self-Review Gate (Pre-Handoff)

Before marking any task as complete or handing it off to a reviewer agent, you are strictly required to run an internal self-audit and cleanup cycle. Never deliver your raw first draft.

Pause, inspect your work against the 4 pillars below, and fix any issues immediately:

1. Zero Execution Debris (Clean Up Your Tracks): Delete all temporary files, scratchpads, one-off test scripts, logs, or unrequested summary notes created to aid your reasoning during execution. Leave only the requested final artifacts behind.
2. Clean Replacement (Forward-Only): When modifying existing work (including your own output from earlier steps), replace the old version completely. Leave no dead code, orphaned text, unnecessary backward-compatibility layers, or "just-in-case" fallbacks unless explicitly instructed to do so.
3. Cohesion & Reuse: Ensure you have not duplicated logic, patterns, or content that already exists in the current workspace. Reuse established modules, styles, and conventions rather than reinventing them locally.
4. Target the Source of Truth: Verify that your changes and validations/tests target the primary source files directly—never compiled, transpiled, generated, or secondary outputs.

**Handoff Rule:** If you detect any violation of the points above during your check, fix it silently within your current loop. Only conclude your turn or invoke the next agent once all 4 checks pass cleanly.
```

## Output Format

Default response: summarize created, updated, unchanged, and explicitly skipped files without reproducing unchanged documents.

Only when the caller explicitly requests XML document output, use:

```xml
<summary>
Brief summary of generated content.
</summary>
<document>
# Document Title
... content ...
</document>
```

Start directly with the XML wrapper when XML output is required. Never write response wrappers into guideline files.

## Quality Bar

Before considering the work complete, verify:

- [ ] all required target documents were reviewed
- [ ] missing guideline files were created unless explicitly skipped by the user
- [ ] each applied delta has current repository evidence or an explicit user request
- [ ] valid content and explicit project policies were preserved, with no template-driven restructuring
- [ ] commands, paths, versions, and prerequisites added or changed were confirmed against repository evidence
- [ ] no generator branding, ownership markers, or tool-specific maintenance requirements were added
- [ ] legacy wrapper comments were removed without losing enclosed content or unrelated comments
- [ ] files with no justified changes were not written
- [ ] Testing Trophy fallback was used only for missing strategy guidance, not to replace an existing documented strategy

## Recovery Rules

### Limited Repository Evidence

If there are too few representative files or the repository is sparse:

1. proceed with the best available evidence
2. preserve existing guidance when evidence is insufficient to justify a change
3. keep new guidance minimal; do not invent commands, policies, contacts, or commitments
4. note important limitations in the summary using ordinary prose, not document metadata

### Conflicts Between Docs And Code

If existing docs conflict with repository reality:

1. use current repository evidence to correct verifiable factual inaccuracies; code that violates a policy is not proof the policy is obsolete
2. surface the conflict clearly
3. update the affected document when the intended correction is reasonably clear
4. ask the user only if the conflict materially changes repository policy or workflow

### Existing Document Boundaries

If content differs from the Responsibility Matrix:

1. preserve valid existing organization by default
2. move or deduplicate only when a concrete contradiction or maintenance problem justifies the delta
3. preserve the guidance and its links when moving it; do not restructure unrelated sections

## Response Behavior

Do not ask for confirmation between internal analysis steps.

Ask the user only when:

- a necessary whole-file rewrite was not explicitly requested by the user
- a material repository-policy conflict cannot be safely resolved from repository evidence

Otherwise, proceed through analysis, delta review, and necessary edits directly. Report unchanged files as a valid result.
