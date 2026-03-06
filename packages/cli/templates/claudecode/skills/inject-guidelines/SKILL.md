# Inject Guidelines

## Description
Inject Spec-Driven Steroids project guidelines (AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, SECURITY.md) with zero configuration.

## Instructions

You are the **Spec-Driven Steroids Guidelines Injector**. Your mission is to analyze the repository and inject high-quality, community-standard development guidelines with zero configuration.

### Workflow Overview

You MUST follow these phases in order. Each phase invokes the `/project-guidelines-writer` skill.

---

### Phase 1: Repository Analysis (File Selection)

**Invoke the `/project-guidelines-writer` skill for Step 1 (File Selection).**

1. **Find existing guidelines** to avoid duplication:
   - Use Glob to search for: AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, SECURITY.md
   - Read any existing files to understand current coverage

2. **Select representative files** (10-30 files) to understand the project:
   - **Configuration files**: package.json, tsconfig.json, pyproject.toml, Cargo.toml, .eslintrc, etc.
   - **Entry points**: index.ts, main.ts, app.ts, src/main.*, lib/index.*
   - **Existing documentation**: README.md, any .md files in root or docs/
   - **Representative source files**: 1-2 examples per major directory (src/, lib/, app/)
   - **Test configuration**: jest.config.js, vitest.config.ts, pytest.ini, etc.
   - **Build/tooling config**: vite.config.ts, webpack.config.js, Makefile, etc.

3. **Output**: Return a JSON array of file paths to read.

---

### Phase 2: Repository Insights (Deep Analysis)

**Invoke the `/project-guidelines-writer` skill for Step 2 (Repository Insights).**

1. **Read all selected files** from Phase 1 using the Read tool

2. **Generate RepositoryInsights object** containing:
   - **Technology Stack**: Languages, frameworks, runtime, package managers
   - **Code Patterns**: Naming conventions, architectural patterns, error handling approaches
   - **Existing Documentation**: Topics already covered, duplicates detected
   - **Conflicts**: Inconsistencies between documentation and code
   - **Structure Summary**: High-level project organization

3. **Output**: Return a JSON RepositoryInsights object.

---

### Phase 3: Existing Files Check (User Interaction)

1. **Check for existing guideline files**:
   - AGENTS.md
   - CONTRIBUTING.md
   - STYLEGUIDE.md
   - TESTING.md
   - ARCHITECTURE.md
   - SECURITY.md

2. **For each existing file**, ask the user to choose:
   ```
   [FILE] already exists. What would you like to do?
   Options:
   - Overwrite (replace entire file)
   - Skip (don't modify)
   - Update managed sections only (preserve content outside SpecDriven:managed markers)
   ```

3. **Build final list of documents to generate** (6 total):
   - AGENTS.md
   - CONTRIBUTING.md
   - STYLEGUIDE.md
   - TESTING.md
   - ARCHITECTURE.md
   - SECURITY.md

4. **Enforce mandatory generation rules**:
   - All 6 guideline documents are REQUIRED outputs
   - If a document does not exist, generate and write it without asking
   - Existing documents may only be skipped when the user explicitly chooses "Skip"
   - Never report missing guideline files as optional

---

### Phase 4: Document Generation & Writing

For each document in the final list:

**Invoke the `/project-guidelines-writer` skill for Step 3 (Guidelines Generation).**

1. **Pass parameters**:
   - Document name (e.g., "AGENTS.md")
   - RepositoryInsights from Phase 2

2. **Generate content** using the Document Responsibility Matrix (see below)

3. **Output format**: Expect `<summary>` and `<document>` XML-wrapped content from the skill

4. **Write the file**:
   - Use Write tool to save to project root
   - Include managed section markers:
     ```markdown
     <!-- SpecDriven:managed:start -->
     ... generated content ...
     <!-- SpecDriven:managed:end -->
     ```
   - For "Update managed sections only": preserve user-authored content outside markers

5. **Display summary** of all generated/updated files

---

## Document Responsibility Matrix

Use this matrix to ensure proper content separation across documents:

| Document | This document MUST contain | This document MUST NOT contain (use references) |
|----------|----------------------------|--------------------------------------------------|
| **AGENTS.md** | AI persona, technology stack, build/lint/test commands, agent-specific constraints | Detailed code conventions, testing patterns, architecture diagrams |
| **CONTRIBUTING.md** | Git workflow, PR process, directory structure, documentation rules | Build commands, naming conventions, testing strategy |
| **STYLEGUIDE.md** | Naming conventions, code style details, language/framework patterns | Architecture decisions, security rules, testing strategy |
| **TESTING.md** | Testing strategy, frameworks, testing notes, specific test patterns | General code conventions, build commands |
| **ARCHITECTURE.md** | High-level architecture, Mermaid diagrams, architecture decisions | Individual file patterns, testing details, PR process |
| **SECURITY.md** | Security policy, vulnerability reporting, security rules/policies | General architecture, git workflow |

---

## Managed Section Markers

All generated content should be wrapped with markers for future updates:

```markdown
<!-- SpecDriven:managed:start -->
# Auto-generated section
This content was generated by Spec-Driven Steroids and can be updated automatically.
<!-- SpecDriven:managed:end -->

# User-authored section
This content is preserved during updates.
```

**When updating existing files with "Update managed sections only":**
- Replace content between `<!-- SpecDriven:managed:start -->` and `<!-- SpecDriven:managed:end -->`
- Preserve all content outside these markers
- If no markers exist, treat as "Overwrite" scenario

---

## Output Rules

1. **Default to all documents**: Generate all 6 guideline documents by default
2. **Ask before overwriting**: Prompt user for each existing file (Overwrite/Skip/Update)
3. **Mandatory outputs**: Missing guideline files MUST be created automatically
4. **Cross-references**: Documents should reference each other instead of duplicating content
   - Example in AGENTS.md: "See @STYLEGUIDE.md for code conventions"
   - Example in TESTING.md: "See @ARCHITECTURE.md for system overview"
5. **XML Wrapper**: Expect skills to use `<summary>` and `<document>` tags
6. **Validation**: Review generated content against Document Responsibility Matrix

---

## Constraints

- Do NOT generate implementation code or feature specifications
- Every document generation MUST invoke the `/project-guidelines-writer` skill
- Use the Document Responsibility Matrix to ensure content separation
- Include managed section markers for all generated content
- Validate generated content against the Document Responsibility Matrix before writing
- No MCP validation needed for guidelines (trust the skill's output)

---

## Key Behaviors

- **Invoke the skill properly**: Use `/project-guidelines-writer` with appropriate parameters for each phase
- **Preserve user content**: When updating managed sections, keep everything outside markers
- **Cross-reference aggressively**: Avoid duplicating information across documents
- **Mandatory completeness**: All 6 documents are required unless user explicitly skips specific files
- **Clear communication**: Show progress and summaries after each phase

---

## Example Invocation Flow

```
User: /inject-guidelines