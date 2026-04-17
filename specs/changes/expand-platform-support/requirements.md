# Requirements

## Overview

This specification defines the requirements for extending Spec-Driven Steroids platform support to include three new CLI-based AI coding assistants: GitHub Copilot CLI, Gemini CLI, and Qwen Code CLI. The goal is to provide a user experience equivalent to the existing OpenCode integration, enabling developers to inject Spec-Driven standards into their workflows regardless of which AI assistant they use.

The existing GitHub Copilot support targets IDE plugins (VS Code, JetBrains), while this specification adds the standalone CLI version. Similarly, Google Antigravity is renamed and reorganized under a more general Gemini CLI support. Qwen Code CLI is a net-new addition.

## Glossary

| Term | Definition |
|------|------------|
| Platform | An AI coding assistant tool that accepts external skills/agents (e.g., OpenCode, Gemini CLI) |
| Skill | A self-contained directory with instructions (SKILL.md + supporting files) that extends a platform's capabilities |
| Agent | A named configuration file that defines specialized behavior for a platform |
| Injection | The process of copying and configuring Spec-Driven artifacts into a user's environment |
| Global scope | Injection available across all projects for a given user |
| Project scope | Injection isolated to a specific project directory |
| External MCP Server | Model Context Protocol server configured by Spec-Driven Steroids for target AI platforms |

## Assumptions

- All three new platforms support skills with YAML frontmatter metadata
- All three platforms support external MCP servers for extending functionality
- The transformation pipeline handles agent and command files; skills are copied as directories
- Global/user-level scope is supported by GitHub Copilot CLI and Gemini CLI; Qwen Code supports user-level skills
- Spec-Driven Steroids configures external MCP servers (sequential-thinking, memory) but does not embed an MCP server itself

## Requirements

### REQ-1: GitHub Copilot CLI Support

**User Story:** As a developer using GitHub Copilot CLI, I want to inject Spec-Driven standards into my workflow, so that I can maintain consistent development practices across my projects.

#### Acceptance Criteria

1.1 WHEN the user selects GitHub Copilot CLI during injection, THEN the CLI SHALL copy universal skills directories to `~/.copilot/skills/` for user-level scope.

1.2 WHEN the user selects GitHub Copilot CLI during injection with project scope, THEN the CLI SHALL copy universal skills directories to `.github/skills/` in the project directory.

1.3 THE CLI SHALL configure external MCP servers in `~/.config/github-copilot/mcp.json` for user-level scope.

1.4 THE CLI SHALL configure external MCP servers in `.github/mcp.json` for project scope.

1.5 THE CLI SHALL transform and write the agent file to the platform-appropriate location using the AGENTS.md format.

1.6 THE CLI SHALL support the `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` environment variable path convention for custom agent discovery.

---

### REQ-2: Gemini CLI Support

**User Story:** As a developer using Gemini CLI, I want to inject Spec-Driven standards into my workflow, so that I can use structured planning workflows with Google's AI assistant.

#### Acceptance Criteria

2.1 WHEN the user selects Gemini CLI during injection, THEN the CLI SHALL copy universal skills directories to `~/.gemini/skills/` for user-level scope.

2.2 WHEN the user selects Gemini CLI during injection with project scope, THEN the CLI SHALL copy universal skills directories to `.gemini/skills/` in the project directory.

2.3 THE CLI SHALL configure external MCP servers in `~/.gemini/mcp_config.json` for user-level scope.

2.4 THE CLI SHALL configure external MCP servers in `.gemini/mcp_config.json` for project scope.

2.5 THE CLI SHALL transform and write the agent file using the SKILL.md format with YAML frontmatter.

2.6 THE CLI SHALL support the `~/.agents/skills/` alias path for skills discovery.

---

### REQ-3: Qwen Code CLI Support

**User Story:** As a developer using Qwen Code CLI, I want to inject Spec-Driven standards into my workflow, so that I can leverage Qwen's capabilities with Spec-Driven methodology.

#### Acceptance Criteria

3.1 WHEN the user selects Qwen Code CLI during injection, THEN the CLI SHALL copy universal skills directories to `~/.qwen/skills/` for user-level scope.

3.2 WHEN the user selects Qwen Code CLI during injection with project scope, THEN the CLI SHALL copy universal skills directories to `.qwen/skills/` in the project directory.

3.3 THE CLI SHALL configure external MCP servers in `~/.qwen/mcp_config.json` for user-level scope.

3.4 THE CLI SHALL configure external MCP servers in `.qwen/mcp_config.json` for project scope.

3.5 THE CLI SHALL transform and write the agent file using the SKILL.md format with YAML frontmatter.

---

### REQ-4: UX Consistency Across Platforms

**User Story:** As a developer, I want the injection experience to be consistent regardless of which AI assistant I use, so that I can easily adopt new platforms without relearning the tool.

#### Acceptance Criteria

4.1 THE inject command SHALL present GitHub Copilot CLI, Gemini CLI, and Qwen Code CLI as platform options alongside existing platforms.

4.2 THE inject command SHALL support user-level and project scope selection for all new platforms.

4.3 THE inject command SHALL prompt for optional external MCP server configuration (sequential-thinking, memory) for all new platforms.

4.4 THE transformation pipeline SHALL produce platform-appropriate filenames and directory structures for each new platform.

4.5 THE clean command SHALL remove globally injected Spec-Driven artifacts from all newly supported platforms that support global injection.

---

### REQ-5: Platform Configuration Parity

**User Story:** As a platform maintainer, I want new platforms to follow the same configuration patterns as existing platforms, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

5.1 THE platform-config.ts SHALL contain entries for `github-copilot-cli`, `gemini-cli`, and `qwen-code` platforms.

5.2 EACH new platform entry SHALL define format type, frontmatter configuration, agent/command directories and filenames.

5.3 THE CLI index.ts SHALL contain configuration functions for each new platform following the existing pattern.

5.4 THE clean command preview SHALL display the paths that will be cleaned for each new platform.

---

### REQ-6: Skill Directory Compatibility

**User Story:** As a developer, I want the same universal skills to work across all platforms, so that I maintain consistent behavior regardless of which AI assistant I use.

#### Acceptance Criteria

6.1 THE universal skills directories SHALL be copyable to all new platform skill directories without modification.

6.2 THE transformation pipeline SHALL adapt agent file naming to match each platform's conventions.

6.3 THE CLI SHALL copy skill directories to the platform's skills location, preserving the SKILL.md structure.