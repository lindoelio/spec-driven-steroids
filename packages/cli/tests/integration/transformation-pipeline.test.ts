import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  transformForPlatform,
  transformTemplates
} from '../../src/cli/transformation-pipeline.js';
import { PLATFORM_CONFIGS } from '../../src/cli/platform-config.js';

describe('Integration: Transformation Pipeline', () => {
  const templatesDir = path.resolve(__dirname, '../../templates');
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transform-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('transformForPlatform', () => {
    it('reads universal agent prompt from correct path', async () => {
      const results = await transformForPlatform('github-vscode', templatesDir, tempDir);
      
      const agentResult = results.find(r => r.sourcePath.includes('spec-driven.agent.md'));
      expect(agentResult).toBeDefined();
      expect(agentResult?.success).toBe(true);
    });

    it('applies correct format transformation per platform', async () => {
      // Test markdown platforms
      const markdownPlatforms = ['github-vscode', 'claudecode', 'opencode', 'antigravity'];
      
      for (const platform of markdownPlatforms) {
        const results = await transformForPlatform(platform, templatesDir, tempDir);
        const agentResult = results.find(r => r.sourcePath.includes('spec-driven.agent.md'));
        
        expect(agentResult?.success).toBe(true);
        expect(agentResult?.outputPath).toMatch(/\.md$/);
      }
      
      // Test TOML platform
      const codexResults = await transformForPlatform('codex', templatesDir, tempDir);
      const codexAgentResult = codexResults.find(r => r.sourcePath.includes('spec-driven.agent.md'));
      
      expect(codexAgentResult?.success).toBe(true);
      expect(codexAgentResult?.outputPath).toMatch(/\.toml$/);
    });

    it('writes to correct output paths', async () => {
      const results = await transformForPlatform('github-vscode', templatesDir, tempDir);
      
      for (const result of results) {
        if (result.success) {
          const exists = await fs.pathExists(result.outputPath);
          expect(exists).toBe(true);
        }
      }
    });

    it('processes inject-guidelines prompt', async () => {
      const results = await transformForPlatform('github-vscode', templatesDir, tempDir);
      
      const guidelinesResult = results.find(r => r.sourcePath.includes('inject-guidelines.command.md'));
      expect(guidelinesResult).toBeDefined();
      expect(guidelinesResult?.success).toBe(true);
    });

    it('preserves body content in transformed output', async () => {
      const results = await transformForPlatform('github-vscode', templatesDir, tempDir);

      for (const result of results) {
        if (result.success) {
          expect(result.bodyPreserved).toBe(true);
        }
      }
    });

    it('produces TOML format for Gemini CLI inject-guidelines commands', async () => {
      const results = await transformForPlatform('gemini-cli', templatesDir, tempDir);

      const guidelinesResult = results.find(r => r.sourcePath.includes('inject-guidelines.command.md'));
      expect(guidelinesResult).toBeDefined();
      expect(guidelinesResult?.success).toBe(true);
      expect(guidelinesResult?.outputPath).toMatch(/\.toml$/);

      const content = await fs.readFile(guidelinesResult!.outputPath, 'utf-8');
      expect(content).toContain('description = "');
      expect(content).toContain('prompt = """');
    });

    it('produces markdown format for Gemini CLI agent files', async () => {
      const results = await transformForPlatform('gemini-cli', templatesDir, tempDir);

      const agentResult = results.find(r => r.sourcePath.includes('spec-driven.agent.md'));
      expect(agentResult).toBeDefined();
      expect(agentResult?.success).toBe(true);
      expect(agentResult?.outputPath).toMatch(/\.md$/);

      const content = await fs.readFile(agentResult!.outputPath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('name:');
    });
  });

  describe('transformTemplates', () => {
    it('transforms for multiple platforms', async () => {
      const platforms = ['github-vscode', 'codex', 'antigravity'];
      
      const results = await transformTemplates(
        platforms,
        templatesDir,
        (platform) => path.join(tempDir, platform)
      );
      
      // github-vscode: 3 results (agent + spec-driven-command + inject-guidelines-command)
      // codex: 3 results (agent + spec-driven-command + inject-guidelines-command)
      // antigravity: 2 results (agent + inject-guidelines-command, no spec-driven-command since it's same as agent)
      // Total: 8
      expect(results.length).toBe(8);
      
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    });
  });
});

// Import afterEach
import { afterEach } from 'vitest';