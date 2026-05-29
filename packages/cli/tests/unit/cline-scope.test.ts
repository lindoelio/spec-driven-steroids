import { describe, it, expect } from 'vitest';
import {
  getClineGlobalConfigDir,
  getClineUserSkillsDir,
  getClineProjectSkillsDir
} from '../../src/cli/cline-scope.js';

describe('Unit: Cline Scope Path Helpers', () => {
  describe('getClineGlobalConfigDir', () => {
    it('returns path containing .cline', () => {
      const result = getClineGlobalConfigDir();
      expect(result).toContain('.cline');
    });
  });

  describe('getClineUserSkillsDir', () => {
    it('returns user-level skills directory', () => {
      const result = getClineUserSkillsDir();
      expect(result).toContain('.cline');
      expect(result).toContain('skills');
    });
  });

  describe('getClineProjectSkillsDir', () => {
    it('returns project-level skills directory', () => {
      const result = getClineProjectSkillsDir('/some/project');
      expect(result).toContain('/some/project/.cline/skills');
    });
  });
});
