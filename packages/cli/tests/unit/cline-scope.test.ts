import { describe, it, expect } from 'vitest';
import {
  getClineGlobalConfigDir,
  getClineUserSkillsDir,
  getClineUserAgentsDir,
  getClineUserCommandsDir,
  getClineProjectSkillsDir,
  getClineProjectAgentsDir,
  getClineProjectCommandsDir
} from '../../src/cli/cline-scope.js';

describe('Unit: Cline Scope Path Helpers', () => {
  describe('getClineGlobalConfigDir', () => {
    it('returns path containing .cline', () => {
      const result = getClineGlobalConfigDir();
      expect(result).toContain('.cline');
    });
  });

  describe('getClineUserAgentsDir', () => {
    it('returns user-level agents directory', () => {
      const result = getClineUserAgentsDir();
      expect(result).toContain('.cline');
      expect(result).toContain('agents');
    });
  });

  describe('getClineUserCommandsDir', () => {
    it('returns user-level commands directory', () => {
      const result = getClineUserCommandsDir();
      expect(result).toContain('.cline');
      expect(result).toContain('commands');
    });
  });

  describe('getClineUserSkillsDir', () => {
    it('returns user-level skills directory', () => {
      const result = getClineUserSkillsDir();
      expect(result).toContain('.cline');
      expect(result).toContain('skills');
    });
  });

  describe('getClineProjectAgentsDir', () => {
    it('returns project-level agents directory', () => {
      const result = getClineProjectAgentsDir('/some/project');
      expect(result).toContain('/some/project/.cline/agents');
    });
  });

  describe('getClineProjectCommandsDir', () => {
    it('returns project-level commands directory', () => {
      const result = getClineProjectCommandsDir('/some/project');
      expect(result).toContain('/some/project/.cline/commands');
    });
  });

  describe('getClineProjectSkillsDir', () => {
    it('returns project-level skills directory', () => {
      const result = getClineProjectSkillsDir('/some/project');
      expect(result).toContain('/some/project/.cline/skills');
    });
  });
});
