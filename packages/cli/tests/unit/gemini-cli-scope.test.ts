import { describe, it, expect } from 'vitest';
import {
  getGeminiCliGlobalMcpPath,
  getGeminiCliGlobalConfigDir,
  getGeminiCliUserSkillsDir,
  getGeminiCliAgentsAliasDir,
  getGeminiCliProjectSkillsDir,
  getGeminiCliProjectMcpPath,
  getGeminiCliUserAgentsDir,
  getGeminiCliUserCommandsDir,
  getGeminiCliProjectAgentsDir,
  getGeminiCliProjectCommandsDir
} from '../../src/cli/gemini-cli-scope.js';

describe('Unit: Gemini CLI Scope Path Helpers', () => {
  describe('getGeminiCliUserAgentsDir', () => {
    it('returns path containing agents directory', () => {
      const result = getGeminiCliUserAgentsDir();
      expect(result).toContain('agents');
      expect(result).toContain('.gemini');
    });

    it('returns user-level agents directory', () => {
      const result = getGeminiCliUserAgentsDir();
      expect(result).toMatch(/\.gemini[\/\\]agents$/);
    });
  });

  describe('getGeminiCliUserCommandsDir', () => {
    it('returns path containing commands directory', () => {
      const result = getGeminiCliUserCommandsDir();
      expect(result).toContain('commands');
      expect(result).toContain('.gemini');
    });

    it('returns user-level commands directory', () => {
      const result = getGeminiCliUserCommandsDir();
      expect(result).toMatch(/\.gemini[\/\\]commands$/);
    });
  });

  describe('getGeminiCliProjectAgentsDir', () => {
    it('returns path containing agents directory', () => {
      const result = getGeminiCliProjectAgentsDir('/some/project');
      expect(result).toContain('agents');
      expect(result).toContain('.gemini');
    });

    it('returns project-level agents directory with correct target', () => {
      const result = getGeminiCliProjectAgentsDir('/some/project');
      expect(result).toContain('/some/project/.gemini/agents');
    });
  });

  describe('getGeminiCliProjectCommandsDir', () => {
    it('returns path containing commands directory', () => {
      const result = getGeminiCliProjectCommandsDir('/some/project');
      expect(result).toContain('commands');
      expect(result).toContain('.gemini');
    });

    it('returns project-level commands directory with correct target', () => {
      const result = getGeminiCliProjectCommandsDir('/some/project');
      expect(result).toContain('/some/project/.gemini/commands');
    });
  });

  describe('existing path helpers', () => {
    it('getGeminiCliGlobalMcpPath returns global MCP config path', () => {
      const result = getGeminiCliGlobalMcpPath();
      expect(result).toContain('.gemini');
      expect(result).toContain('mcp_config.json');
    });

    it('getGeminiCliGlobalConfigDir returns global config directory', () => {
      const result = getGeminiCliGlobalConfigDir();
      expect(result).toContain('.gemini');
    });

    it('getGeminiCliUserSkillsDir returns user skills directory', () => {
      const result = getGeminiCliUserSkillsDir();
      expect(result).toContain('.gemini');
      expect(result).toContain('skills');
    });

    it('getGeminiCliAgentsAliasDir returns alias directory', () => {
      const result = getGeminiCliAgentsAliasDir();
      expect(result).toContain('.agents');
      expect(result).toContain('skills');
    });

    it('getGeminiCliProjectSkillsDir returns project-level skills directory', () => {
      const result = getGeminiCliProjectSkillsDir('/some/project');
      expect(result).toContain('/some/project/.gemini/skills');
    });

    it('getGeminiCliProjectMcpPath returns project-level MCP config path', () => {
      const result = getGeminiCliProjectMcpPath('/some/project');
      expect(result).toContain('/some/project/.gemini/mcp_config.json');
    });
  });
});