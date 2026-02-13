---
description: Inject project guidelines (AGENTS.md, CONTRIBUTING.md, etc.) using project-guidelines-writer skill
skill: project-guidelines-writer
---

Inject Spec-Driven Steroids project guidelines for this repository.

$ARGUMENTS

Follow the project-guidelines-writer skill workflow:

**Phase 1: Repository Analysis**
- Glob and Read existing guidelines to avoid duplication
- Select 10-30 representative files (config, entry points, docs, source)

**Phase 2: Repository Insights**
- Generate RepositoryInsights JSON (Tech Stack, Code Patterns, Existing Docs, Conflicts, Structure)

**Phase 3: Existing Files Check**
- Ask user how to handle each existing file (Overwrite/Skip/Update managed sections)
- All 6 documents are mandatory for missing files

**Phase 4: Document Generation**
- Generate all 6 documents: AGENTS.md, CONTRIBUTING.md, STYLEGUIDE.md, TESTING.md, ARCHITECTURE.md, SECURITY.md
- Apply Document Responsibility Matrix for content separation
- Include `<!-- SpecDriven:managed:start/end -->` markers
