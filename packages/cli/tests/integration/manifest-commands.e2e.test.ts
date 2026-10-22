import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: manifest commands', () => {
  let targetDir: string;
  let originalCwd: string;
  let mockHomeDir: string;

  async function injectProjectOpenCode(): Promise<void> {
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ platforms: ['opencode'] })
      .mockResolvedValueOnce({ scope: 'project' });
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['inject'], { from: 'user' } as any);
  }

  let activeLogSpy: ReturnType<typeof vi.spyOn> | undefined;

  function captureOutput(): string[] {
    const output: string[] = [];
    activeLogSpy = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });
    return output;
  }

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

  it('templates info reports the bundled source', async () => {
    const output = captureOutput();
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['templates', 'info', '--source', 'bundled', '--json'], { from: 'user' } as any);

    const parsed = JSON.parse(output.join('\n')) as { source: string; version: string };
    expect(parsed.source).toBe('bundled');
    expect(parsed.version).toBe('bundled');
  });

  it('doctor reports healthy then drifted installs', async () => {
    await injectProjectOpenCode();

    const healthyOutput = captureOutput();
    let { createProgram } = await import('../../src/cli/index.js');
    let program = createProgram();
    await program.parseAsync(['doctor', '--format', 'json'], { from: 'user' } as any);
    const healthy = JSON.parse(healthyOutput.join('\n')) as { healthy: boolean };
    expect(healthy.healthy).toBe(true);
    expect(process.exitCode).toBe(0);

    activeLogSpy?.mockRestore();
    await fs.appendFile(path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'), '\nmodified');

    const driftOutput = captureOutput();
    ({ createProgram } = await import('../../src/cli/index.js'));
    program = createProgram();
    await program.parseAsync(['doctor', '--format', 'json'], { from: 'user' } as any);
    const drift = JSON.parse(driftOutput.join('\n')) as { healthy: boolean; installs: Array<{ modified: string[] }> };
    expect(drift.healthy).toBe(false);
    expect(drift.installs[0].modified.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(1);
  });

  it('repair restores missing files', async () => {
    await injectProjectOpenCode();
    const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
    await fs.remove(agentPath);

    const output = captureOutput();
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['repair', '--project', '--json'], { from: 'user' } as any);

    expect(await fs.pathExists(agentPath)).toBe(true);
    const parsed = JSON.parse(output.join('\n')) as { repaired: Array<{ ok: boolean }> };
    expect(parsed.repaired[0].ok).toBe(true);
  });

  it('uninstall removes manifest-tracked files', async () => {
    await injectProjectOpenCode();
    const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');

    const output = captureOutput();
    const { createProgram } = await import('../../src/cli/index.js');
    const program = createProgram();
    await program.parseAsync(['uninstall', '--project', '--yes', '--json'], { from: 'user' } as any);

    expect(await fs.pathExists(agentPath)).toBe(false);
    const parsed = JSON.parse(output.join('\n')) as { removed: string[] };
    expect(parsed.removed.length).toBeGreaterThan(0);
  });
});
