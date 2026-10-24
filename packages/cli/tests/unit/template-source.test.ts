import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveTemplateSource } from '../../src/cli/template-source.js';
import { MAX_TEMPLATE_FILES } from '../../src/cli/template-bundle.js';

const tempDirs: string[] = [];
const plannerFiles = {
  'universal/skills/spec-driven-planner/SKILL.md': 'Planner skill',
  'universal/skills/spec-driven-planner/references/lane-selection.md': 'Lane selection',
  'universal/skills/spec-driven-planner/references/full-lane-phases.md': 'Full phases'
};

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sds-template-source-'));
  tempDirs.push(dir);
  return dir;
}

function responseFor(data: unknown): Response {
  const text = JSON.stringify(data);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-length': String(Buffer.byteLength(text)) }),
    text: async () => text,
    json: async () => data
  } as unknown as Response;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function createBundle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    version: 'v1',
    files: {
      'universal/agents/spec-driven.agent.md': '---\nname: Spec-Driven\n---\n\nAgent'
    },
    ...overrides
  };
}

function createManifest(bundle: Record<string, unknown>, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    version: bundle.version,
    bundleUrl: 'https://example.test/templates-bundle.json',
    sha256: sha256(JSON.stringify(bundle)),
    ...overrides
  };
}

function createFetch(manifest: Record<string, unknown>, bundle: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/templates-manifest.json')) return responseFor(manifest);
    if (url.endsWith('/templates-bundle.json')) return responseFor(bundle);
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

async function resolve(
  overrides: Partial<Parameters<typeof resolveTemplateSource>[0]> = {},
  rootDir?: string
) {
  const cacheRoot = rootDir ?? await createTempDir();
  const bundledTemplatesDir = path.join(cacheRoot, 'bundled');
  await fs.ensureDir(bundledTemplatesDir);

  return resolveTemplateSource({
    bundledTemplatesDir,
    cacheDir: path.join(cacheRoot, 'cache'),
    manifestUrl: 'https://example.test/templates-manifest.json',
    cliVersion: '1.0.0',
    source: 'remote',
    ...overrides
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('Unit: remote template source hardening', () => {
  it('downloads, verifies, extracts, and returns remote templates', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);

    const result = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result.source).toBe('remote');
    expect(result.version).toBe('v1');
    expect(result.sha256).toBe(manifest.sha256);
    expect(await fs.pathExists(path.join(result.rootDir, 'universal/agents/spec-driven.agent.md'))).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached bundle and only fetches the manifest again', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);
    const root = await createTempDir();

    const first = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch }, root);
    const second = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch }, root);

    expect(first.source).toBe('remote');
    expect(second.source).toBe('remote');
    expect(second.rootDir).toBe(first.rootDir);
    expect(second.warnings).toContain('Using cached template bundle.');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each(Object.keys(plannerFiles))('rejects a remote bundle missing required planner file %s', async missingFile => {
    const files: Record<string, string> = { ...plannerFiles };
    delete files[missingFile];
    const bundle = createBundle({ files });
    const manifest = createManifest(bundle);
    const result = await resolve({ requiredSkills: ['spec-driven-planner'], fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('incompatible');
    expect(result.fallbackReason).toContain(missingFile);
  });

  it('uses a complete required planner from the network and cache', async () => {
    const bundle = createBundle({ files: plannerFiles });
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);
    const root = await createTempDir();
    const options = { requiredSkills: ['spec-driven-planner'], fetchImpl: fetchImpl as unknown as typeof fetch };
    expect((await resolve(options, root)).source).toBe('remote');
    const cached = await resolve(options, root);
    expect(cached.source).toBe('remote');
    expect(cached.warnings).toContain('Using cached template bundle.');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('rejects an intact older cache that lacks newly required skills', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);
    const root = await createTempDir();
    await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch }, root);
    const result = await resolve({ requiredSkills: ['spec-driven-planner'], fetchImpl: fetchImpl as unknown as typeof fetch }, root);
    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('incompatible');
    expect(result.fallbackReason).toContain('spec-driven-planner/SKILL.md');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('restores a required planner reference removed from cache', async () => {
    const bundle = createBundle({ files: plannerFiles });
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);
    const root = await createTempDir();
    const options = { requiredSkills: ['spec-driven-planner'], fetchImpl: fetchImpl as unknown as typeof fetch };
    const first = await resolve(options, root);
    const file = path.join(first.rootDir, 'universal/skills/spec-driven-planner/references/lane-selection.md');
    await fs.remove(file);
    const result = await resolve(options, root);
    expect(result.source).toBe('remote');
    expect(await fs.readFile(file, 'utf8')).toBe('Lane selection');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('re-downloads the bundle when cached files were modified', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle);
    const fetchImpl = createFetch(manifest, bundle);
    const root = await createTempDir();

    const first = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch }, root);
    await fs.writeFile(path.join(first.rootDir, 'universal/agents/spec-driven.agent.md'), 'tampered', 'utf8');

    const second = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch }, root);

    expect(second.source).toBe('remote');
    expect(second.warnings).not.toContain('Using cached template bundle.');
    const restored = await fs.readFile(path.join(second.rootDir, 'universal/agents/spec-driven.agent.md'), 'utf8');
    expect(restored).toContain('Agent');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('rejects a path-traversal version without deleting files outside the cache', async () => {
    const root = await createTempDir();
    const sentinel = path.join(root, 'sentinel.txt');
    await fs.writeFile(sentinel, 'keep me');
    const bundle = createBundle();
    const manifest = createManifest(bundle, { version: '..' });

    const result = await resolve({
      cacheDir: path.join(root, 'cache'),
      fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch
    });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('invalid');
    expect(await fs.pathExists(sentinel)).toBe(true);
  });

  it('rejects a traversal file path inside the bundle', async () => {
    const bundle = createBundle({ files: { '../../escape.txt': 'x' } });
    const manifest = createManifest(bundle);

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('invalid');
    expect(result.fallbackReason).toContain('Invalid template path');
  });

  it('rejects an absolute or Windows-drive file path', async () => {
    const absoluteBundle = createBundle({ files: { '/etc/passwd': 'x' } });
    const absoluteManifest = createManifest(absoluteBundle);
    const absolute = await resolve({
      fetchImpl: createFetch(absoluteManifest, absoluteBundle) as unknown as typeof fetch
    });
    expect(absolute.source).toBe('bundled');

    const driveBundle = createBundle({ files: { 'C:\\Windows\\system.ini': 'x' } });
    const driveManifest = createManifest(driveBundle);
    const drive = await resolve({
      fetchImpl: createFetch(driveManifest, driveBundle) as unknown as typeof fetch
    });
    expect(drive.source).toBe('bundled');
  });

  it('rejects a digest mismatch as an integrity failure', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle, { sha256: '0'.repeat(64) });

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('integrity');
    expect(result.fallbackReason).toContain('digest mismatch');
  });

  it('rejects a non-HTTPS bundle URL', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle, { bundleUrl: 'http://example.test/bundle.json' });

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('HTTPS');
  });

  it('rejects a bundle URL on an unapproved host', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle, { bundleUrl: 'https://evil.example/templates-bundle.json' });

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('not allowed');
  });

  it('rejects an incompatible schema version', async () => {
    const bundle = createBundle({ schemaVersion: 99 });
    const manifest = createManifest(bundle, { schemaVersion: 99 });

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('incompatible');
  });

  it('rejects bundles that require a newer CLI', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle, { minCliVersion: '99.0.0' });

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('incompatible');
  });

  it('accepts legacy manifests without a digest and warns about the missing integrity check', async () => {
    const bundle = createBundle();
    const manifest = createManifest(bundle);
    delete manifest.sha256;

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('remote');
    expect(result.warnings.join(' ')).toContain('no sha256 digest');
  });

  it('rejects bundles with too many files', async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index <= MAX_TEMPLATE_FILES; index += 1) {
      files[`universal/file-${index}.md`] = 'x';
    }
    const bundle = createBundle({ files });
    const manifest = createManifest(bundle);

    const result = await resolve({ fetchImpl: createFetch(manifest, bundle) as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('too many files');
  });

  it('falls back to bundled templates on network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await resolve({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result.source).toBe('bundled');
    expect(result.errorKind).toBe('network');
    expect(result.fallbackReason).toContain('offline');
  });

  it('honors the legacy bundled-templates environment variable', async () => {
    process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
    try {
      const result = await resolve();
      expect(result.source).toBe('bundled');
    } finally {
      delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    }
  });
});
