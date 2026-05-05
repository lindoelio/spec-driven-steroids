---
"spec-driven-steroids": minor
---

feat: Extract shared protocols and templates from phase skills

Refactored the 4 spec-driven phase skills to reference shared content instead of duplicating it inline. This reduces redundancy and improves maintainability.

- Created `universal/skills/shared/` skill with externalized document templates and shared protocols
- Extracted Context Preflight, Phase Gate, Validation CLI, and Todo List protocols to `shared/references/shared-protocol.md`
- Extracted requirements.md, design.md, and tasks.md templates to `shared/references/document-templates.md`
- Refactored phase skills to reference shared content (requirements-writer: 217 lines, technical-designer: 203 lines, task-decomposer: 228 lines, task-implementer: 232 lines)
- Added Behavioral Guidelines section to AGENTS.md (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution)
- Updated project-guidelines-writer to generate Behavioral Guidelines when creating AGENTS.md
- Updated unit tests to reflect the refactored structure