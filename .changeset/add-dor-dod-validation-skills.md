---
"spec-driven-steroids": minor
---

Add DoR and DoD validation as universal skills.

Two new skills are available after `inject`:

- `spec-driven-dor-validation` — gate between requirements and design.
  Evaluates clarity, completeness, feasibility, and traceability of
  `requirements.md` before the technical designer begins work.

- `spec-driven-dod-validation` — gate before merge. Evaluates
  specification compliance, code quality, testing, documentation, and
  design integrity of the completed implementation.

Both skills follow the same pass/fail/na pattern used across the
workflow and complement the existing MCP structural validation with
content-quality gates.
