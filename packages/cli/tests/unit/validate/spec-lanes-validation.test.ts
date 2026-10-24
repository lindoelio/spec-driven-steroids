import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySpec } from '../../../src/core/validate/spec.js';
import { verifySpecStructure } from '../../../src/core/validate/structure.js';

const validBrief = `# Change Brief

**Lane:** brief

## Intent

Validate a lightweight approved plan.

## Non-Goals

- Changing full-lane validation.

## Acceptance Criteria

- REQ-1: The brief is validated before implementation.

## Repository Evidence

- Existing: \`src/validate.ts\` - Validation entry point.

## Implementation Plan

- [ ] 1. Validate the brief
  - Change: Add deterministic brief validation.
  - Files: \`src/validate.ts\`
  - Verify: \`pnpm test\`
  - _Implements: REQ-1_

## Final Verification

- \`pnpm test\`
`;

describe('Unit: spec lane validation', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  function createSpecDir(slug = 'change'): string {
    tempDir = mkdtempSync(path.join(tmpdir(), 'sds-lanes-'));
    const specDir = path.join(tempDir, '.specs', 'changes', slug);
    mkdirSync(specDir, { recursive: true });
    return specDir;
  }

  it('accepts a directory containing only brief.md', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'brief.md'), validBrief);

    const structure = await verifySpecStructure('change', tempDir!);
    const spec = await verifySpec('change', tempDir!);

    expect(structure.valid).toBe(true);
    expect(structure.lane).toBe('brief');
    expect(spec.valid).toBe(true);
    expect(spec.lane).toBe('brief');
  });

  it('preserves the full three-file structure', async () => {
    const specDir = createSpecDir();
    for (const file of ['requirements.md', 'design.md', 'tasks.md']) {
      writeFileSync(path.join(specDir, file), '');
    }

    const result = await verifySpecStructure('change', tempDir!);

    expect(result.valid).toBe(true);
    expect(result.lane).toBe('full');
  });

  it('reports missing files for a partial full structure', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'requirements.md'), '');

    const result = await verifySpecStructure('change', tempDir!);

    expect(result.valid).toBe(false);
    expect(result.lane).toBe('full');
    expect(result.missingFiles).toEqual(['design.md', 'tasks.md']);
  });

  it('rejects mixed brief and full artifacts', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'brief.md'), validBrief);
    writeFileSync(path.join(specDir, 'requirements.md'), '');

    const result = await verifySpecStructure('change', tempDir!);
    const spec = await verifySpec('change', tempDir!);

    expect(result.valid).toBe(false);
    expect(result.lane).toBe('brief');
    expect(result.unexpectedFiles).toContain('requirements.md');
    expect(spec.valid).toBe(false);
    expect(spec.errors.some(error => error.context?.includes('Unexpected files found'))).toBe(true);
    expect(spec.errors.some(error => error.context?.includes('Mixed lane artifacts: brief.md, requirements.md'))).toBe(true);
  });

  it.each(['brief', 'full'])('ignores inactive .archive snapshots for the %s lane', async lane => {
    const specDir = createSpecDir();
    mkdirSync(path.join(specDir, '.archive'));
    for (const file of ['brief.md', 'requirements.md', 'design.md', 'tasks.md']) {
      writeFileSync(path.join(specDir, '.archive', file), 'inactive snapshot');
    }
    const active = lane === 'brief' ? ['brief.md'] : ['requirements.md', 'design.md', 'tasks.md'];
    for (const file of active) writeFileSync(path.join(specDir, file), lane === 'brief' ? validBrief : '');

    const result = await verifySpecStructure('change', tempDir!);
    expect(result.valid).toBe(true);
    expect(result.lane).toBe(lane);
    expect(result.unexpectedFiles).toEqual([]);
  });

  it.each([false, true])('reports no active lane without assuming missing full documents (archive: %s)', async archived => {
    const specDir = createSpecDir();
    if (archived) {
      mkdirSync(path.join(specDir, '.archive'));
      writeFileSync(path.join(specDir, '.archive', 'brief.md'), validBrief);
    }

    const structure = await verifySpecStructure('change', tempDir!);
    expect(structure.valid).toBe(false);
    expect(structure.missingFiles).toEqual([]);
    expect(structure.errors).toHaveLength(1);
    expect(structure.errors[0].context).toBe('No lane artifacts found');

    const spec = await verifySpec('change', tempDir!);
    expect(spec.valid).toBe(false);
    expect(spec.errors).toHaveLength(1);
    expect(spec.errors[0].context).toBe('No lane artifacts found');
    expect(spec.requirementsErrors).toEqual([]);
  });

  it('rejects extra files in either lane', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'brief.md'), validBrief);
    writeFileSync(path.join(specDir, 'notes.md'), 'notes');

    const result = await verifySpecStructure('change', tempDir!);

    expect(result.valid).toBe(false);
    expect(result.unexpectedFiles).toEqual(['notes.md']);
  });

  it('ignores OS and hidden files in the spec directory', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'brief.md'), validBrief);
    writeFileSync(path.join(specDir, '.DS_Store'), '');
    writeFileSync(path.join(specDir, '.notes'), 'hidden');

    const result = await verifySpecStructure('change', tempDir!);

    expect(result.valid).toBe(true);
    expect(result.unexpectedFiles).toEqual([]);
  });

  it('propagates brief validation failures through validate spec', async () => {
    const specDir = createSpecDir();
    writeFileSync(path.join(specDir, 'brief.md'), validBrief.replace('REQ-1_', 'REQ-9_'));

    const result = await verifySpec('change', tempDir!);

    expect(result.valid).toBe(false);
    expect(result.lane).toBe('brief');
    expect(result.briefErrors.some(error => error.includes('REQ-9'))).toBe(true);
  });
});
