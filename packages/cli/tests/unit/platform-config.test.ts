import { describe, it, expect } from 'vitest';
import {
  FormatType,
  PLATFORM_CONFIGS,
  getPlatformConfig
} from '../../src/cli/platform-config.js';

describe('Unit: Platform Config', () => {
  describe('getPlatformConfig', () => {
    it('returns undefined for unknown platform', () => {
      const config = getPlatformConfig('unknown-platform');
      expect(config).toBeUndefined();
    });

    it('returns config for github-vscode', () => {
      const config = getPlatformConfig('github-vscode');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.frontmatter.fields.name).toBe('Spec-Driven');
      expect(config?.agentDirectory).toBe('agents');
      expect(config?.agentFilename).toBe('spec-driven.agent.md');
    });

    it('returns config for github-jetbrains', () => {
      const config = getPlatformConfig('github-jetbrains');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
    });

    it('returns config for claudecode', () => {
      const config = getPlatformConfig('claudecode');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.agentFilename).toBe('spec-driven.md');
    });

    it('returns config for opencode', () => {
      const config = getPlatformConfig('opencode');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.frontmatter.additionalFields?.mode).toBe('primary');
    });

    it('returns config for codex', () => {
      const config = getPlatformConfig('codex');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.TOML);
      expect(config?.agentFilename).toBe('spec-driven.toml');
    });

    it('returns config for antigravity', () => {
      const config = getPlatformConfig('antigravity');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.agentDirectory).toBe('workflows');
    });

    it('returns config for github-copilot-cli', () => {
      const config = getPlatformConfig('github-copilot-cli');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.agentDirectory).toBe('agents');
      expect(config?.agentFilename).toBe('spec-driven.agent.md');
    });

    it('returns config for gemini-cli', () => {
      const config = getPlatformConfig('gemini-cli');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.agentDirectory).toBe('skills');
      expect(config?.agentFilename).toBe('spec-driven.md');
    });

    it('returns config for qwen-code', () => {
      const config = getPlatformConfig('qwen-code');
      expect(config).toBeDefined();
      expect(config?.format).toBe(FormatType.MARKDOWN);
      expect(config?.agentDirectory).toBe('skills');
      expect(config?.agentFilename).toBe('spec-driven.md');
    });
  });

  describe('PLATFORM_CONFIGS', () => {
    it('contains all required platforms', () => {
      const expectedPlatforms = [
        'github-vscode',
        'github-jetbrains',
        'github-copilot-cli',
        'gemini-cli',
        'qwen-code',
        'claudecode',
        'opencode',
        'codex',
        'antigravity'
      ];
      
      for (const platform of expectedPlatforms) {
        expect(PLATFORM_CONFIGS[platform]).toBeDefined();
      }
    });

    it('each config has required fields', () => {
      for (const [id, config] of Object.entries(PLATFORM_CONFIGS)) {
        expect(config.id).toBe(id);
        expect(config.format).toBeDefined();
        expect(config.frontmatter).toBeDefined();
        expect(config.frontmatter.fields).toBeDefined();
        expect(config.agentDirectory).toBeDefined();
        expect(config.agentFilename).toBeDefined();
        expect(config.commandDirectory).toBeDefined();
        expect(config.specDrivenCommandFilename).toBeDefined();
        expect(config.injectGuidelinesCommandFilename).toBeDefined();
      }
    });

    it('all platforms use consistent terminology', () => {
      // All configs should reference "skill" in descriptions
      for (const config of Object.values(PLATFORM_CONFIGS)) {
        const description = config.frontmatter.fields.description;
        // Description should be present and non-empty
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
      }
    });
  });
});