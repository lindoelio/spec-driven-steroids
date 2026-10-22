import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: install manifest lifecycle', () => {
  let targetDir: string;
  let originalCwd: string;
  let mockHomeDir: string;

  const installDir = () => path.join(os.homedir(), '.config', 'spec-driven-steroids', 'installs');

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
    process.exitCode = 0;
    vi.unstubAllGlobals();
    await mockFs.cleanup();
  });

  it('writes a manifest and cleans only tracked project files', async () => {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['opencode'] })
      .mockResolvedValueOnce({ scope: 'project' });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);

    const manifestFiles = await fs.readdir(installDir());
    expect(manifestFiles.some(file => file.startsWith('opencode-project-'))).toBe(true);

    await fs.outputFile(path.join(targetDir, '.opencode', 'user-notes.md'), 'keep');

    await program.parseAsync(['clean', '--project', '--yes'], { from: 'user' } as any);

    expect(await fs.pathExists(path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'))).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, '.opencode', 'user-notes.md'))).toBe(true);
    expect((await fs.readdir(installDir())).some(file => file.startsWith('opencode-project-'))).toBe(false);
  });

  it('skips modified files unless --force is supplied', async () => {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['opencode'] })
      .mockResolvedValueOnce({ scope: 'project' });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);

    const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
    await fs.appendFile(agentPath, '\n\nUser modification');

    await program.parseAsync(['clean', '--project', '--yes'], { from: 'user' } as any);
    expect(await fs.pathExists(agentPath)).toBe(true);
    expect((await fs.readdir(installDir())).some(file => file.startsWith('opencode-project-'))).toBe(true);

    await program.parseAsync(['clean', '--project', '--yes', '--force'], { from: 'user' } as any);
    expect(await fs.pathExists(agentPath)).toBe(false);
  });

  it('cleans global manifest-tracked files without touching unrelated global files', async () => {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['opencode'] })
      .mockResolvedValueOnce({ scope: 'global' });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);

    const globalDir = path.join(os.homedir(), '.config', 'opencode');
    await fs.outputFile(path.join(globalDir, 'user-config.json'), '{"user":true}');

    await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

    expect(await fs.pathExists(path.join(globalDir, 'agents', 'spec-driven.agent.md'))).toBe(false);
    expect(await fs.pathExists(path.join(globalDir, 'user-config.json'))).toBe(true);
  });

  it('emits JSON for project cleanup', async () => {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['opencode'] })
      .mockResolvedValueOnce({ scope: 'project' });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);

    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    await program.parseAsync(['clean', '--project', '--yes', '--json'], { from: 'user' } as any);

    const parsed = JSON.parse(output.join('\n')) as { scope: string; removed: string[] };
    expect(parsed.scope).toBe('project');
    expect(parsed.removed.length).toBeGreaterThan(0);
  });

  it('tracks flattened VS Code global prompt files and removes them on uninstall', async () => {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['github-vscode'] })
      .mockResolvedValueOnce({ scope: 'global' });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);

    const promptsDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'prompts')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
        : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');

    const agentPath = path.join(promptsDir, 'spec-driven.agent.md');
    const promptPath = path.join(promptsDir, 'spec-driven.prompt.md');
    expect(await fs.pathExists(agentPath)).toBe(true);
    expect(await fs.pathExists(promptPath)).toBe(true);

    const manifestPath = path.join(installDir(), 'github-vscode-global-global.json');
    const manifest = await fs.readJson(manifestPath) as { files: Array<{ path: string }> };
    const tracked = manifest.files.map(file => file.path);
    expect(tracked).toContain(agentPath);
    expect(tracked).toContain(promptPath);

    await program.parseAsync(
      ['uninstall', '--platform', 'github-vscode', '--scope', 'global', '--yes'],
      { from: 'user' } as any
    );

    expect(await fs.pathExists(agentPath)).toBe(false);
    expect(await fs.pathExists(promptPath)).toBe(false);
  });

  it('cleans legacy project files that predate the install manifest', async () => {
    const legacyFile = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
    await fs.outputFile(legacyFile, 'legacy agent');

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['clean', '--project', '--yes'], { from: 'user' } as any);

    expect(await fs.pathExists(legacyFile)).toBe(false);
  });
});
