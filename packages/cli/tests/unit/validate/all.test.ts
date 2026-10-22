import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { mockFs, getFixtureFiles } from '@spec-driven-steroids/test-utils';

import { createAllCommand } from '../../../src/core/validate/all.js';

const hasGit = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Unit: validate all', () => {
  afterEach(async () => {
    process.exitCode = 0;
    vi.restoreAllMocks();
    await mockFs.cleanup();
  });

  it('aggregates valid and invalid specs as JSON', async () => {
    const targetDir = await mockFs.createTempDir();
    const changesDir = path.join(targetDir, '.specs', 'changes');

    const validBrief = `# Change Brief

**Lane:** brief

## Intent

Reduce repeated validation work while preserving an approval gate.

## Non-Goals

- Changing the full workflow gates.

## Acceptance Criteria

- REQ-1: The CLI validates a compact brief artifact.
- REQ-2: Every brief requirement maps to implementation work.

## Repository Evidence

- Existing: \`src/validate.ts\` - Validation entry point to extend.
- New: \`tests/brief.test.ts\` - Coverage for brief validation.

## Implementation Plan

- [ ] 1. Add brief validation
  - Change: Parse the brief structure and report deterministic errors.
  - Files: \`src/validate.ts\`, \`tests/brief.test.ts\`
  - Verify: \`pnpm test brief\`
  - _Implements: REQ-1, REQ-2_

## Final Verification

- \`pnpm typecheck\`
- \`pnpm test\`
`;

    await fs.outputFile(path.join(changesDir, 'valid-spec', 'brief.md'), validBrief);

    const invalidFiles = await getFixtureFiles('invalid-missing-files');
    for (const [filename, content] of Object.entries(invalidFiles)) {
      await fs.outputFile(path.join(changesDir, 'invalid-spec', filename), content);
    }

    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    const command = createAllCommand();
    await command.parseAsync(['--target-dir', targetDir, '--format', 'json'], { from: 'user' });

    const parsed = JSON.parse(output.join('\n')) as {
      valid: boolean;
      specs: Array<{ slug: string; valid: boolean }>;
    };

    expect(parsed.valid).toBe(false);
    expect(parsed.specs.find(spec => spec.slug === 'valid-spec')?.valid).toBe(true);
    expect(parsed.specs.find(spec => spec.slug === 'invalid-spec')?.valid).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('handles an empty changes directory as valid', async () => {
    const targetDir = path.join(os.tmpdir(), `sds-empty-${Date.now()}`);
    await fs.ensureDir(path.join(targetDir, '.specs', 'changes'));

    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    try {
      const command = createAllCommand();
      await command.parseAsync(['--target-dir', targetDir, '--format', 'json'], { from: 'user' });
      const parsed = JSON.parse(output.join('\n')) as { valid: boolean; specs: unknown[] };
      expect(parsed.valid).toBe(true);
      expect(parsed.specs).toHaveLength(0);
      expect(process.exitCode).toBe(0);
    } finally {
      await fs.remove(targetDir);
    }
  });

  it('fails when --changed references an unknown git ref', async () => {
    const targetDir = await mockFs.createTempDir();
    await fs.outputFile(path.join(targetDir, '.specs', 'changes', 'broken', 'brief.md'), 'nonsense');

    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    const command = createAllCommand();
    await command.parseAsync(
      ['--target-dir', targetDir, '--changed', 'does-not-exist', '--format', 'json'],
      { from: 'user' }
    );

    const parsed = JSON.parse(output.join('\n')) as { valid: boolean; specs: unknown[]; error?: string };
    expect(parsed.valid).toBe(false);
    expect(parsed.specs).toHaveLength(0);
    expect(parsed.error).toContain('does-not-exist');
    expect(process.exitCode).toBe(2);
  });

  it.skipIf(!hasGit)('does not fall back to all specs when a valid ref has no spec changes', async () => {
    const targetDir = await mockFs.createTempDir();
    execFileSync('git', ['init', '-q'], { cwd: targetDir });
    execFileSync(
      'git',
      ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-q', '--allow-empty', '-m', 'init'],
      { cwd: targetDir }
    );
    await fs.outputFile(path.join(targetDir, '.specs', 'changes', 'broken', 'brief.md'), 'nonsense');

    const output: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      output.push(String(value ?? ''));
    });

    const command = createAllCommand();
    await command.parseAsync(
      ['--target-dir', targetDir, '--changed', 'HEAD', '--format', 'json'],
      { from: 'user' }
    );

    const parsed = JSON.parse(output.join('\n')) as { valid: boolean; specs: unknown[]; message?: string };
    expect(parsed.valid).toBe(true);
    expect(parsed.specs).toHaveLength(0);
    expect(parsed.message).toContain('No spec changes');
    expect(process.exitCode).toBe(0);
  });
});
