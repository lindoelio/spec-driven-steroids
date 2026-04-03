import { describe, it, expect } from 'vitest';
import {
  transformToMarkdown,
  transformToToml,
  transform,
  verifyBodyPreserved
} from '../../src/cli/format-transformer.js';
import { FormatType, PLATFORM_CONFIGS } from '../../src/cli/platform-config.js';

describe('Unit: Format Transformer', () => {
  const testBody = `# Spec-Driven Planner

You are the **Spec-Driven Planner**.

## Phase Gatekeeper

You MUST enforce this lifecycle exactly.`;

  describe('transformToMarkdown', () => {
    it('generates YAML frontmatter with platform-specific fields', () => {
      const config = PLATFORM_CONFIGS['github-vscode'];
      const result = transformToMarkdown(testBody, config);
      
      expect(result).toContain('---');
      expect(result).toContain('name:');
      expect(result).toContain('description:');
      expect(result).toContain('---');
    });

    it('includes body content unchanged', () => {
      const config = PLATFORM_CONFIGS['github-vscode'];
      const result = transformToMarkdown(testBody, config);
      
      expect(result).toContain('# Spec-Driven Planner');
      expect(result).toContain('## Phase Gatekeeper');
    });

    it('includes additional fields for OpenCode', () => {
      const config = PLATFORM_CONFIGS['opencode'];
      const result = transformToMarkdown(testBody, config);
      
      expect(result).toContain('mode: primary');
    });
  });

  describe('transformToToml', () => {
    it('wraps body in developer_instructions multi-line string', () => {
      const config = PLATFORM_CONFIGS['codex'];
      const result = transformToToml(testBody, config);
      
      expect(result).toContain('developer_instructions = """');
      expect(result).toContain('# Spec-Driven Planner');
      expect(result).toContain('"""');
    });

    it('includes required TOML fields', () => {
      const config = PLATFORM_CONFIGS['codex'];
      const result = transformToToml(testBody, config);
      
      expect(result).toContain('name =');
      expect(result).toContain('description =');
      expect(result).toContain('sandbox_mode =');
    });

    it('escapes special characters in string fields', () => {
      const config = PLATFORM_CONFIGS['codex'];
      const bodyWithQuotes = `Test "quoted" text`;
      const result = transformToToml(bodyWithQuotes, config);
      
      // The body inside multi-line string should preserve quotes
      expect(result).toContain('Test "quoted" text');
    });
  });

  describe('verifyBodyPreserved', () => {
    it('returns true for markdown when body is preserved', () => {
      const config = PLATFORM_CONFIGS['github-vscode'];
      const transformed = transformToMarkdown(testBody, config);
      
      const preserved = verifyBodyPreserved(testBody, transformed, 'markdown');
      expect(preserved).toBe(true);
    });

    it('returns true for TOML when body is preserved', () => {
      const config = PLATFORM_CONFIGS['codex'];
      const transformed = transformToToml(testBody, config);
      
      const preserved = verifyBodyPreserved(testBody, transformed, 'toml');
      expect(preserved).toBe(true);
    });

    it('returns false when body is modified', () => {
      const config = PLATFORM_CONFIGS['github-vscode'];
      const transformed = transformToMarkdown(testBody + ' modified', config);
      
      const preserved = verifyBodyPreserved(testBody, transformed, 'markdown');
      expect(preserved).toBe(false);
    });
  });

  describe('transform', () => {
    it('selects markdown transformer for markdown format', () => {
      const config = PLATFORM_CONFIGS['github-vscode'];
      const result = transform(testBody, config);
      
      expect(result.content).toContain('---');
      expect(result.bodyPreserved).toBe(true);
    });

    it('selects TOML transformer for TOML format', () => {
      const config = PLATFORM_CONFIGS['codex'];
      const result = transform(testBody, config);
      
      expect(result.content).toContain('developer_instructions');
      expect(result.bodyPreserved).toBe(true);
    });

    it('verifies body preservation automatically', () => {
      const configs = [
        PLATFORM_CONFIGS['github-vscode'],
        PLATFORM_CONFIGS['claudecode'],
        PLATFORM_CONFIGS['opencode'],
        PLATFORM_CONFIGS['codex'],
        PLATFORM_CONFIGS['antigravity']
      ];
      
      for (const config of configs) {
        const result = transform(testBody, config);
        expect(result.bodyPreserved).toBe(true);
      }
    });
  });
});