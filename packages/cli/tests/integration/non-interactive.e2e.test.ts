import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: non-interactive inject', () => {
  let targetDir: string;
  let originalCwd: string;
  let mockHomeDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    targetDir = await mockFs.createTempDir();
    mockHomeDir = await mockFs.createTempDir();
    process.chdir(targetDir);
    process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
    process.env.SDS_CONFIG_DIR = path.join(mockHomeDir, '.config', 'spec-driven-steroids');
    vi.clearAllMocks();
    vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    delete process.env.SDS_CONFIG_DIR;
    process.exitCode = 0;
    vi.restoreAllMocks();
    await mockFs.cleanup();
  });

  it('injects without prompts and emits JSON', async () => {
    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync([
      'inject',
      '--platform', 'opencode',
      '--scope', 'project',
      '--yes',
      '--json'
    ], { from: 'user' } as any);

    const parsed = JSON.parse(output.join('\n')) as {
      scope: string;
      dryRun: boolean;
      results: Array<{ platform: string; ok: boolean; scope: string }>;
    };

    expect(parsed.scope).toBe('project');
    expect(parsed.dryRun).toBe(false);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]).toMatchObject({ platform: 'opencode', ok: true, scope: 'project' });

    const manifestDir = path.join(process.env.SDS_CONFIG_DIR as string, 'installs');
    expect((await fs.readdir(manifestDir)).some(file => file.startsWith('opencode-project-'))).toBe(true);
  });

  it('supports dry-run without writing files or manifests', async () => {
    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync([
      'inject',
      '--platform', 'opencode',
      '--scope', 'project',
      '--yes',
      '--json',
      '--dry-run'
    ], { from: 'user' } as any);

    const parsed = JSON.parse(output.join('\n')) as { dryRun: boolean; results: Array<{ files: string[] }> };
    expect(parsed.dryRun).toBe(true);
    expect(parsed.results[0].files.length).toBeGreaterThan(0);

    expect(await fs.pathExists(path.join(targetDir, '.opencode'))).toBe(false);
    const manifestDir = path.join(process.env.SDS_CONFIG_DIR as string, 'installs');
    expect(await fs.pathExists(manifestDir)).toBe(false);
  });

  it('rejects unknown platforms with exit code 2', async () => {
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync([
      'inject',
      '--platform', 'not-a-platform',
      '--yes'
    ], { from: 'user' } as any);

    expect(process.exitCode).toBe(2);
  });

  it('requires --platform when --yes is used', async () => {
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject', '--yes'], { from: 'user' } as any);

    expect(process.exitCode).toBe(2);
  });

  it('defaults to global scope instead of prompting when --yes is used', async () => {
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject', '--platform', 'opencode', '--yes'], { from: 'user' } as any);

    expect(await fs.pathExists(path.join(os.homedir(), '.config', 'opencode', 'agents', 'spec-driven.agent.md'))).toBe(true);
  });
});
