# spec-driven-steroids

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
