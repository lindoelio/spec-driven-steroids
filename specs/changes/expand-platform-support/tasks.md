# Implementation Tasks

## Overview

This implementation adds support for three new CLI-based AI coding assistant platforms: GitHub Copilot CLI, Gemini CLI, and Qwen Code CLI. The work is organized into 5 phases.

**Estimated Effort**: Medium (4-6 sessions)

## Phase 1: Scope Resolution Modules

- [x] 1.1 Create github-copilot-cli-scope.ts
  - Define InjectionScope enum with USER and PROJECT values
  - Implement getGitHubCopilotCliGlobalConfigPath() returning `~/.config/github-copilot/mcp.json`
  - Implement getGitHubCopilotCliGlobalConfigDir() returning `~/.config/github-copilot`
  - Implement getGitHubCopilotCliUserSkillsDir() returning `~/.copilot/skills/`
  - _Implements: DES-2, REQ-1.1_

- [x] 1.2 Create gemini-cli-scope.ts
  - Define InjectionScope enum with USER and PROJECT values
  - Implement getGeminiCliGlobalConfigPath() returning `~/.gemini/mcp_config.json`
  - Implement getGeminiCliUserSkillsDir() returning `~/.gemini/skills/`
  - Implement getGeminiCliAgentsAliasDir() returning `~/.agents/skills/`
  - _Implements: DES-2, REQ-2.1, REQ-2.6_

- [x] 1.3 Create qwen-code-scope.ts
  - Define InjectionScope enum with USER and PROJECT values
  - Implement getQwenCodeGlobalConfigPath() returning `~/.qwen/mcp_config.json`
  - Implement getQwenCodeUserSkillsDir() returning `~/.qwen/skills/`
  - _Implements: DES-2, REQ-3.1_

## Phase 2: Platform Configurations

- [x] 2.1 Add platform-config.ts entries for new platforms
  - Add `github-copilot-cli` entry with Markdown format, `agents/spec-driven.agent.md`
  - Add `gemini-cli` entry with Markdown format (SKILL.md), `skills/spec-driven.md`
  - Add `qwen-code` entry with Markdown format (SKILL.md), `skills/spec-driven.md`
  - Each entry includes frontmatter fields: name, description
  - _Implements: DES-1, REQ-5.1, REQ-5.2_

## Phase 3: MCP Configuration Functions

- [x] 3.1 Add configureGitHubCopilotCliMcp function
  - Read existing `~/.config/github-copilot/mcp.json` or create new
  - Preserve existing external MCP server entries without adding SDS-owned reasoning or memory servers
  - Write updated config
  - _Implements: DES-3, REQ-1.3_

- [x] 3.2 Add configureGeminiCliMcp function
  - Read existing `~/.gemini/mcp_config.json` or create new
  - Preserve existing external MCP server entries without adding SDS-owned reasoning or memory servers
  - Write updated config
  - _Implements: DES-3, REQ-2.3_

- [x] 3.3 Add configureQwenCodeMcp function
  - Read existing `~/.qwen/mcp_config.json` or create new
  - Preserve existing external MCP server entries without adding SDS-owned reasoning or memory servers
  - Write updated config
  - _Implements: DES-3, REQ-3.3_

## Phase 4: Injection Command Wiring

- [x] 4.1 Add new platforms to inject command choices
  - Add `github-copilot-cli` to platform selection checkbox
  - Add `gemini-cli` to platform selection checkbox
  - Add `qwen-code` to platform selection checkbox
  - _Implements: REQ-4.1_

- [x] 4.2 Wire scope selection for new platforms
  - Add new platforms to GLOBAL_CAPABLE_PLATFORMS array
  - Derive scope from unified scope for each new platform
  - _Implements: REQ-4.2_

- [x] 4.3 Add injection logic for GitHub Copilot CLI
  - Copy universal skills to `~/.copilot/skills/` for user scope
  - Copy universal skills to `.github/skills/` for project scope
  - Transform agent to `spec-driven.agent.md` in `agents/` directory
  - Call configureGitHubCopilotCliMcp
  - _Implements: REQ-1.1, REQ-1.2, REQ-1.4, REQ-1.5_

- [x] 4.4 Add injection logic for Gemini CLI
  - Copy universal skills to `~/.gemini/skills/` for user scope
  - Copy universal skills to `.gemini/skills/` for project scope
  - Transform agent to `spec-driven.md` in `skills/` directory
  - Call configureGeminiCliMcp
  - _Implements: REQ-2.1, REQ-2.2, REQ-2.4, REQ-2.5_

- [x] 4.5 Add injection logic for Qwen Code
  - Copy universal skills to `~/.qwen/skills/` for user scope
  - Copy universal skills to `.qwen/skills/` for project scope
  - Transform agent to `spec-driven.md` in `skills/` directory
  - Call configureQwenCodeMcp
  - _Implements: REQ-3.1, REQ-3.2, REQ-3.4, REQ-3.5_

## Phase 5: Clean Command Integration

- [x] 5.1 Add removal functions for new platforms
  - Add removeGitHubCopilotCliSteroids() removing `~/.copilot/skills/spec-driven-*`
  - Add removeGeminiCliSteroids() removing `~/.gemini/skills/spec-driven-*`
  - Add removeQwenCodeSteroids() removing `~/.qwen/skills/spec-driven-*`
  - _Implements: DES-4, REQ-4.5_

- [x] 5.2 Update buildCleanPreview function
  - Add GitHub Copilot CLI paths to preview
  - Add Gemini CLI paths to preview
  - Add Qwen Code paths to preview
  - _Implements: REQ-5.4_

## Phase 6: Acceptance Criteria Testing

- [x] 6.1 Test: GitHub Copilot CLI user-level injection
  - Verify skills copied to `~/.copilot/skills/`
  - Verify MCP config created at `~/.config/github-copilot/mcp.json`
  - Test type: integration
  - _Implements: REQ-1.1, REQ-1.3_

- [x] 6.2 Test: GitHub Copilot CLI project-level injection
  - Verify skills copied to `.github/skills/`
  - Verify MCP config created at `.github/mcp.json`
  - Verify agent file created at `.github/agents/spec-driven.agent.md`
  - Test type: integration
  - _Implements: REQ-1.2, REQ-1.4, REQ-1.5_

- [x] 6.3 Test: Gemini CLI user-level injection
  - Verify skills copied to `~/.gemini/skills/`
  - Verify skills also available at `~/.agents/skills/` alias
  - Verify MCP config created at `~/.gemini/mcp_config.json`
  - Test type: integration
  - _Implements: REQ-2.1, REQ-2.3, REQ-2.6_

- [x] 6.4 Test: Gemini CLI project-level injection
  - Verify skills copied to `.gemini/skills/`
  - Verify MCP config created at `.gemini/mcp_config.json`
  - Verify agent file created at `.gemini/skills/spec-driven.md`
  - Test type: integration
  - _Implements: REQ-2.2, REQ-2.4, REQ-2.5_

- [x] 6.5 Test: Qwen Code user-level injection
  - Verify skills copied to `~/.qwen/skills/`
  - Verify MCP config created at `~/.qwen/mcp_config.json`
  - Test type: integration
  - _Implements: REQ-3.1, REQ-3.3_

- [x] 6.6 Test: Qwen Code project-level injection
  - Verify skills copied to `.qwen/skills/`
  - Verify MCP config created at `.qwen/mcp_config.json`
  - Verify agent file created at `.qwen/skills/spec-driven.md`
  - Test type: integration
  - _Implements: REQ-3.2, REQ-3.4, REQ-3.5_

- [x] 6.7 Test: transformation pipeline produces correct output
  - Verify github-copilot-cli produces AGENTS.md format
  - Verify gemini-cli produces SKILL.md format
  - Verify qwen-code produces SKILL.md format
  - Test type: unit
  - _Implements: REQ-4.4, REQ-6.2_

- [x] 6.8 Test: clean command removes new platform artifacts
  - Verify clean removes GitHub Copilot CLI artifacts
  - Verify clean removes Gemini CLI artifacts
  - Verify clean removes Qwen Code artifacts
  - Test type: integration
  - _Implements: REQ-4.5_

## Phase 7: Final Checkpoint

- [x] 7.1 Verify all acceptance criteria
  - REQ-1: GitHub Copilot CLI support verified
  - REQ-2: Gemini CLI support verified
  - REQ-3: Qwen Code CLI support verified
  - REQ-4: UX consistency across platforms verified
  - REQ-5: Platform configuration parity verified
  - REQ-6: Skill directory compatibility verified
  - Run `pnpm typecheck` and `pnpm test`
  - _Implements: All requirements_
