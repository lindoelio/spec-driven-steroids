---
"spec-driven-steroids": patch
---

Rename shared skill to spec-driven-shared-protocol

### Fixes
- **Skill Rename**: The `shared` skill is now named `spec-driven-shared-protocol` for clarity and consistency.
- **Phase Skill References**: All four phase skills (requirements-writer, technical-designer, task-decomposer, task-implementer) now reference `spec-driven-shared-protocol` instead of `spec-driven-shared`.
- **Clean Support**: Added `spec-driven-shared-protocol` to `STEROIDS_SKILL_DIRS` so `sds clean --global` properly removes it.
- **Tests**: Updated template validation tests to assert the new skill name and file paths.
- **Injected Copies**: Synchronized the renamed skill under `.agents/skills/`.
