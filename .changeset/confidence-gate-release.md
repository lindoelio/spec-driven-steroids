---
"spec-driven-steroids": minor
---

Add Confidence Gate Protocol with Red Team Challenge and raise quality grading threshold to 5.

### Features
- **Confidence Gate Protocol**: Mandatory adversarial self-review (Red Team Challenge) before every approval request. Agents must declare ≥90% confidence and find at least 3 weaknesses before asking for human approval.
- **Red Team Pass in Auditor**: The `agent-work-auditor` skill now requires a rejector-persona pass with artifact-specific adversarial questions for requirements, design, and tasks.
- **Quality Grading Integration**: All planning phase skills (requirements, design, tasks) now invoke `quality-grading` in `grade-and-fix` mode before approval.
- **Implementation Confidence Gates**: Task implementer gains Phase 4.5 (pre-audit) and Phase 6 (final sign-off) Confidence Gates before declaring completion.
- **Spec-Driven Agent Hardening**: Planner template enforces Confidence Gate Rule with blocking language — approval requests below 90% are physically barred.
- **Raised Quality Bar**: `quality-grading` auto-fix threshold raised from 4 to 5. All dimensions must now score perfect/near-perfect (5) before proceeding.

### Tests
- Added unit tests asserting Confidence Gate content in shared protocol, auditor artifacts, planner template, and phase skills.
- Added E2E test verifying Confidence Gate Rule is injected across OpenCode, GitHub Copilot, and Antigravity platforms.
