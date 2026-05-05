import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: Gemini CLI injection', () => {
  let targetDir: string;
  let originalCwd: string;
  let mockHomeDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    targetDir = await mockFs.createTempDir();
    mockHomeDir = await mockFs.createTempDir();
    process.chdir(targetDir);
    vi.clearAllMocks();
    vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await mockFs.cleanup();
  });

  describe('user-level injection', () => {
    it('creates correct directory structure for Gemini CLI user-level injection', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const geminiDir = path.join(mockHomeDir, '.gemini');
      expect(await fs.pathExists(geminiDir)).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'agents'))).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'commands'))).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'skills'))).toBe(true);
      expect(await fs.pathExists(path.join(targetDir, '.gemini'))).toBe(false);
    });

    it('copies agent file to ./.gemini/agents/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const agentPath = path.join(mockHomeDir, '.gemini', 'agents', 'spec-driven.md');
      expect(await fs.pathExists(agentPath)).toBe(true);
      const content = await fs.readFile(agentPath, 'utf-8');
      expect(content).toContain('name: spec-driven');
      expect(content).toContain('## Phase Gatekeeper');
    });

    it('creates inject-guidelines command as TOML in ./.gemini/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(mockHomeDir, '.gemini', 'commands', 'inject-guidelines.toml');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('description = "');
      expect(content).toContain('prompt = """');
    });

    it('creates spec-driven command as TOML in ~/.gemini/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(mockHomeDir, '.gemini', 'commands', 'spec-driven.toml');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('description = "');
      expect(content).toContain('prompt = """');
      expect(await fs.pathExists(path.join(mockHomeDir, '.gemini', 'commands', 'spec-driven.md'))).toBe(false);
    });

    it('copies universal skills to ./.gemini/skills/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const skillsPath = path.join(mockHomeDir, '.gemini', 'skills', 'long-running-work-planning', 'SKILL.md');
      expect(await fs.pathExists(skillsPath)).toBe(true);
    });

    it('does NOT create ~/.agents/skills/ during Gemini CLI user-level injection', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const aliasDir = path.join(mockHomeDir, '.agents', 'skills');
      expect(await fs.pathExists(aliasDir)).toBe(false);
    });
  });

  describe('project-level injection', () => {
    it('creates correct directory structure for Gemini CLI project-level injection', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const geminiDir = path.join(targetDir, '.gemini');
      expect(await fs.pathExists(geminiDir)).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'agents'))).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'commands'))).toBe(true);
      expect(await fs.pathExists(path.join(geminiDir, 'skills'))).toBe(true);
    });

    it('copies agent file to ./.gemini/agents/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const agentPath = path.join(targetDir, '.gemini', 'agents', 'spec-driven.md');
      expect(await fs.pathExists(agentPath)).toBe(true);
      const content = await fs.readFile(agentPath, 'utf-8');
      expect(content).toContain('## Phase Gatekeeper');
    });

    it('creates inject-guidelines command as TOML in ./.gemini/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(targetDir, '.gemini', 'commands', 'inject-guidelines.toml');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('description = "');
      expect(content).toContain('prompt = """');
    });

    it('creates spec-driven command as TOML in ./.gemini/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(targetDir, '.gemini', 'commands', 'spec-driven.toml');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('description = "');
      expect(content).toContain('prompt = """');
      expect(await fs.pathExists(path.join(targetDir, '.gemini', 'commands', 'spec-driven.md'))).toBe(false);
    });

    it('copies universal skills to ./.gemini/skills/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['gemini-cli'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const skillsPath = path.join(targetDir, '.gemini', 'skills', 'long-running-work-planning', 'SKILL.md');
      expect(await fs.pathExists(skillsPath)).toBe(true);
    });
  });
});
