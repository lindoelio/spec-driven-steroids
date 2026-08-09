import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: Qoder CLI / IDE injection', () => {
  let targetDir: string;
  let originalCwd: string;
  let mockHomeDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    targetDir = await mockFs.createTempDir();
    mockHomeDir = await mockFs.createTempDir();
    process.chdir(targetDir);
    process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
    vi.clearAllMocks();
    vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await mockFs.cleanup();
  });

  describe('user-level injection', () => {
    it('creates correct directory structure for Qoder CLI / IDE user-level injection', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const qoderDir = path.join(mockHomeDir, '.qoder');
      expect(await fs.pathExists(qoderDir)).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'agents'))).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'commands'))).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'skills'))).toBe(true);
      expect(await fs.pathExists(path.join(targetDir, '.qoder'))).toBe(false);
    });

    it('copies agent file to ~/.qoder/agents/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const agentPath = path.join(mockHomeDir, '.qoder', 'agents', 'spec-driven.md');
      expect(await fs.pathExists(agentPath)).toBe(true);
      const content = await fs.readFile(agentPath, 'utf-8');
      expect(content).toContain('name: spec-driven');
      expect(content).toContain('## Lifecycle');
    });

    it('creates spec-driven command as markdown in ~/.qoder/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(mockHomeDir, '.qoder', 'commands', 'spec-driven.md');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('description:');
      expect(content).toContain('Start Spec-Driven planning for this request:');
    });

    it('creates inject-guidelines command as markdown in ~/.qoder/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(mockHomeDir, '.qoder', 'commands', 'inject-guidelines.md');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('name: inject-guidelines');
      expect(content).toContain('Spec-Driven Steroids Guidelines Injector');
    });

    it('copies universal skills to ~/.qoder/skills/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'global' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const skillsPath = path.join(mockHomeDir, '.qoder', 'skills', 'long-running-work-planning', 'SKILL.md');
      expect(await fs.pathExists(skillsPath)).toBe(true);
    });
  });

  describe('project-level injection', () => {
    it('creates correct directory structure for Qoder CLI / IDE project-level injection', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const qoderDir = path.join(targetDir, '.qoder');
      expect(await fs.pathExists(qoderDir)).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'agents'))).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'commands'))).toBe(true);
      expect(await fs.pathExists(path.join(qoderDir, 'skills'))).toBe(true);
      expect(await fs.pathExists(path.join(mockHomeDir, '.qoder'))).toBe(false);
    });

    it('copies agent file to ./.qoder/agents/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const agentPath = path.join(targetDir, '.qoder', 'agents', 'spec-driven.md');
      expect(await fs.pathExists(agentPath)).toBe(true);
      const content = await fs.readFile(agentPath, 'utf-8');
      expect(content).toContain('## Lifecycle');
    });

    it('creates spec-driven command as markdown in ./.qoder/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(targetDir, '.qoder', 'commands', 'spec-driven.md');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('Start Spec-Driven planning for this request:');
    });

    it('creates inject-guidelines command as markdown in ./.qoder/commands/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const commandPath = path.join(targetDir, '.qoder', 'commands', 'inject-guidelines.md');
      expect(await fs.pathExists(commandPath)).toBe(true);
      const content = await fs.readFile(commandPath, 'utf-8');
      expect(content).toContain('name: inject-guidelines');
    });

    it('copies universal skills to ./.qoder/skills/', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ platforms: ['qoder'] })
        .mockResolvedValueOnce({ scope: 'project' });

      const program = (await import('../../dist/cli/index.js')).default;
      await program.parseAsync(['inject'], { from: 'user' } as any);

      const skillsPath = path.join(targetDir, '.qoder', 'skills', 'long-running-work-planning', 'SKILL.md');
      expect(await fs.pathExists(skillsPath)).toBe(true);
    });
  });
});
