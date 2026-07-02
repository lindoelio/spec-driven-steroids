# spec-driven-steroids

## 0.16.0

### Minor Changes

- Add per-phase test tasks to task decomposition and remove the Requirement Implementation Coverage section from tasks.md. Each implementation-bearing phase now requires at least one `Test:` task to verify work before proceeding to the next phase.

## 0.15.3

### Patch Changes

- Fix OpenAI Codex injection to emit command wrappers as Codex skills instead of unsupported `.codex/commands` slash-command files. Codex users can now invoke the `spec-driven` and `inject-guidelines` workflows through Codex skills while retaining the native TOML custom agent.

## 0.15.2

### Patch Changes

- Add parallel sub-agent execution support with concrete delegation instructions for Red Team Review, Code Review, and task implementation on OpenCode and Task-tool platforms.

## 0.15.1

### Patch Changes

- Fix Cline injection to use skills directory instead of unsupported agents/commands directories. The spec-driven agent is now emitted as `~/.cline/skills/spec-driven/SKILL.md` which Cline auto-registers as the `/spec-driven` slash command.

## 0.15.0

### Minor Changes

- Streamline spec-driven workflow with unified quality gates and sub-agent reviews

  Major workflow optimization:

  - Replace multiple per-phase validations (quality-grading + agent-work-auditor + Red Team) with single Unified Quality Gate per phase
  - Move Red Team Challenge to single cross-artifact review after all specs are approved, before implementation starts
  - Add mandatory Code Review sub-agent gate after all implementation tasks complete
  - Replace subjective Confidence: X% scoring with evidence-based verdicts (PASS, PASS WITH NOTES, FAIL)
  - Remove Phases 4.5, 5, 6 from task implementer (consolidated into Code Review)
  - Clarify phase terminology: only gates with human or sub-agent approval are "phases"

  New lifecycle:
  Phase 1: Requirements → Phase 2: Design → Phase 3: Tasks → Red Team Review (sub-agent) → Phase 4: Implementation → Code Review (sub-agent) → Done

  Benefits:

  - ~40% reduction in prompt token overhead (removed triple duplication)
  - 80% fewer Red Team invocations (5 → 1 per workflow)
  - 75% fewer agent-work-auditor invocations (4 → 1 per workflow)
  - Honest, evidence-based quality assessment instead of fake confidence scores
  - Clearer phase structure with explicit human/sub-agent gates

## 0.14.1

### Patch Changes

- fix: make coverage section parser tolerant to heading and table format variations

## 0.14.0

### Minor Changes

- Add Cline platform support, enhance context stewardship orchestrator, strengthen design/tasks validation, and expand skill templates with execution patterns

  ### Features

  - **Cline Platform Support**: `sds inject` now supports Cline as a target platform with user/project scope injection. Agents, commands, and skills are injected into `~/.cline` (global) or `<project>/.cline` (project). Includes `cline-scope` module, platform config, and clean support.
  - **Context Stewardship Orchestrator**: Enhanced orchestrator with richer context resolution, improved phase injection, and project-scoped resolver updates.
  - **Stronger Validation**: Design and tasks validators now enforce stricter guidance checks for higher-quality spec artifacts.
  - **Expanded Skill Templates**: Document-templates, task-patterns, and task-execution-patterns references expanded with execution patterns and richer guidance.

  ### Tests

  - Added unit tests for `cline-scope` module and updated platform-config, context-stewardship acceptance, and spec-validation tests.

## 0.13.1

### Patch Changes

- fcb3a5b: Rename shared skill to spec-driven-shared-protocol

  ### Fixes

  - **Skill Rename**: The `shared` skill is now named `spec-driven-shared-protocol` for clarity and consistency.
  - **Phase Skill References**: All four phase skills (requirements-writer, technical-designer, task-decomposer, task-implementer) now reference `spec-driven-shared-protocol` instead of `spec-driven-shared`.
  - **Clean Support**: Added `spec-driven-shared-protocol` to `STEROIDS_SKILL_DIRS` so `sds clean --global` properly removes it.
  - **Tests**: Updated template validation tests to assert the new skill name and file paths.
  - **Injected Copies**: Synchronized the renamed skill under `.agents/skills/`.

## 0.13.0

### Minor Changes

- a9ffea9: Add Confidence Gate Protocol with Red Team Challenge and raise quality grading threshold to 5.

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

## 0.12.1

### Patch Changes

- Fix cross-platform agent field injection: remove hardcoded `agent` from universal templates and map it per-platform via `PlatformConfig.commandAgents`. VSCode/JetBrains inject-guidelines no longer incorrectly emits `agent: build`. OpenCode retains `agent: build` for inject-guidelines and `agent: Spec-Driven` for spec-driven commands.

## 0.12.0

### Minor Changes

- 671ab34: feat: Extract shared protocols and templates from phase skills

  Refactored the 4 spec-driven phase skills to reference shared content instead of duplicating it inline. This reduces redundancy and improves maintainability.

  - Created `universal/skills/shared/` skill with externalized document templates and shared protocols
  - Extracted Context Preflight, Phase Gate, Validation CLI, and Todo List protocols to `shared/references/shared-protocol.md`
  - Extracted requirements.md, design.md, and tasks.md templates to `shared/references/document-templates.md`
  - Refactored phase skills to reference shared content (requirements-writer: 217 lines, technical-designer: 203 lines, task-decomposer: 228 lines, task-implementer: 232 lines)
  - Added Behavioral Guidelines section to AGENTS.md (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution)
  - Updated project-guidelines-writer to generate Behavioral Guidelines when creating AGENTS.md
  - Updated unit tests to reflect the refactored structure

### Patch Changes

- 82cebbc: fix: Prevent skill copy and clean operations on ~/.agents/skills/ alias path

  The CLI was incorrectly copying skills to ~/.agents/skills/ during Gemini CLI user-level injection and incorrectly attempting to clean skills from that path. This path is an alias/discovery path and must never be modified by the CLI.

  - Removed buggy code that copied skills to ~/.agents/skills/ during Gemini CLI USER injection
  - Removed buggy code that attempted to remove skills from ~/.agents/skills/ during clean
  - Added integration tests to verify the fix

## 0.11.0

### Minor Changes

- Remove MCP config injection from all platforms. Integrate context-stewardship knowledge graph as `sds stewardship` CLI command. Delete antigravity-scope, dead exports, no-op validators, barrel file. Rename mcp-context-injector to phase-context-injector. Deduplicate formatError. Update spec-driven skills with richer stewardship references.

## 0.10.0

### Minor Changes

- 9a63e46: feat: add Rigorous Against Prompt/Spec as CORE auditing dimension

  - agent-work-auditor: Add "Rigorous Against Prompt/Spec" as 7th core dimension (was in spec-driven extension)
  - agent-work-auditor: Update spec-driven extension to note this dimension is now CORE
  - Enables autonomous auditing workflow across all spec-driven phases

## 0.9.0

### Minor Changes

- Add `sds` CLI alias and update validation documentation

  - Add `sds` as short alias for `spec-driven-steroids` CLI
  - Update AGENTS.md to reference CLI-based validation (not MCP)
  - Update skill instructions with CLI validation discovery sections
  - Enforce only requirements.md, design.md, and tasks.md as valid spec documents

## 0.8.0

### Minor Changes

- Multiple enhancements and fixes since 0.7.1 release

## 0.7.1

### Patch Changes

- 756d7a6: Generalized Contextual Stewardship skill, removed Portuguese terminology, and formally integrated it into all Spec-Driven workflow phases (Requirements -> Design -> Tasks)

## 0.7.0

### Minor Changes

- Added Claude Code platform support
  - Created `.claude/agents/spec-driven.md` orchestration agent for full Spec-Driven workflow
  - Created `.claude/commands/inject-guidelines.md` command for project guidelines generation
  - Created `.claude/commands/spec-driven.md` command for project Spec-Driven workflow
  - Added `.claude/CLAUDE.md` main project context file (auto-loaded at startup)
  - Configured MCP server integration via `.mcp.json`
  - Universal skills automatically injected to `.claude/skills/`

## 0.6.0

### Minor Changes

- 00937c2: Release `0.6.0` with a broad prompt and template quality upgrade across the Spec-Driven workflow.

  Highlights:

  - rewrite the universal Spec-Driven skills for requirements, technical design, task decomposition, task implementation, and project guideline generation to improve clarity, validator alignment, and LLM efficiency
  - normalize the `spec-driven` and `inject-guidelines` user experience across GitHub, OpenCode, Antigravity, and Codex wrappers so phase gating, approvals, traceability, and guideline generation behave much more consistently
  - align Codex support with current Codex conventions by using a native TOML custom agent, removing redundant Codex-local `AGENTS.md`, and simplifying Codex command prompts
  - tighten EARS and Mermaid guidance to reduce malformed artifacts and make generated `requirements.md` and `design.md` files more reliable with the built-in validators
  - update template and integration tests to reflect the normalized cross-platform behavior and strengthened prompt contracts

  This release is focused on better publishing quality, stronger platform parity, and more reliable downstream generation from the bundled templates.

## 0.5.0

### Minor Changes

- feat(cli): add JetBrains global MCP configuration support
- feat(skills): enforce behavior-focused test naming without IDs
- feat(github-copilot): enable full implementation phase in spec-driven agent
- feat(landing-page): improve workflow visualization and add responsive design
- docs: update repository guidelines with Testing Trophy strategy

## 0.4.0

### Minor Changes

- Improve spec-driven template guidance by making test task names behavior-focused with traceability kept in `_Implements`, and default generated `TESTING.md` strategy to Testing Trophy when repository testing conventions are inconsistent.

## 0.3.1

### Patch Changes

- Add testing phase to task decomposition and change-type-aware design

  - Task Decomposer: mandatory Acceptance Criteria Testing phase with one test task per AC
  - Task Implementer: guidance for handling test tasks
  - Technical Designer: change type classification, section applicability guide, data flow diagrams
  - Fixtures: updated valid-complete-spec to include testing phase

## 0.3.0

### Minor Changes

- Consolidated `@spec-driven-steroids/mcp` and `@spec-driven-steroids/standards` into the main `spec-driven-steroids` package.
- CLI, MCP server, and templates are now distributed as a single npm package.
- Added `spec-driven-mcp` binary for running the MCP server directly.
- Eliminated cross-package resolution logic, fixing template and MCP path bugs in global installs.
- Simplified publishing workflow to a single package release.

## 0.2.0

### Minor Changes

- First stable release of Spec-Driven Steroids toolkit
