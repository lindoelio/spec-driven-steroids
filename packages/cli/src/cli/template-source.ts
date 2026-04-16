import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export const DEFAULT_TEMPLATE_MANIFEST_URL = 'https://github.com/lindoelio/spec-driven-steroids/releases/download/templates-latest/templates-manifest.json';

export type TemplateSourceKind = 'bundled' | 'remote';

export interface TemplateSourceResolution {
  source: TemplateSourceKind;
  rootDir: string;
  version: string;
  fallbackReason?: string;
}

export interface RemoteTemplateManifest {
  version: string;
  bundleUrl: string;
  publishedAt?: string;
}

export interface RemoteTemplateBundle {
  version: string;
  files: Record<string, string>;
}

export interface ResolveTemplateSourceOptions {
  bundledTemplatesDir: string;
  cacheDir?: string;
  manifestUrl?: string;
  fetchImpl?: typeof fetch;
}

function getDefaultCacheDir(): string {
  return path.join(os.homedir(), '.cache', 'spec-driven-steroids', 'templates');
}

function normalizeRelativeTemplatePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

  if (!normalized || normalized.includes('..')) {
    throw new Error(`Invalid template path: ${relativePath}`);
  }

  return normalized;
}

async function readRemoteJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
}

async function writeBundleToCache(bundle: RemoteTemplateBundle, cacheDir: string): Promise<string> {
  const versionDir = path.join(cacheDir, bundle.version);
  const extractionDir = path.join(versionDir, 'templates');

  await fs.remove(versionDir);
  await fs.ensureDir(extractionDir);

  const entries = Object.entries(bundle.files);

  if (entries.length === 0) {
    throw new Error('Template bundle does not contain any files');
  }

  for (const [relativePath, contents] of entries) {
    const safeRelativePath = normalizeRelativeTemplatePath(relativePath);
    const destination = path.join(extractionDir, safeRelativePath);
    await fs.ensureDir(path.dirname(destination));
    await fs.writeFile(destination, contents, 'utf8');
  }

  return extractionDir;
}

export async function resolveTemplateSource(options: ResolveTemplateSourceOptions): Promise<TemplateSourceResolution> {
  const {
    bundledTemplatesDir,
    cacheDir = getDefaultCacheDir(),
    manifestUrl = DEFAULT_TEMPLATE_MANIFEST_URL,
    fetchImpl = fetch
  } = options;

  if (process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES === 'true') {
    return {
      source: 'bundled',
      rootDir: bundledTemplatesDir,
      version: 'bundled',
      fallbackReason: 'SPEC_DRIVEN_USE_BUNDLED_TEMPLATES is set'
    };
  }

  try {
    const manifest = await readRemoteJson<RemoteTemplateManifest>(manifestUrl, fetchImpl);

    if (!manifest.version || !manifest.bundleUrl) {
      throw new Error('Template manifest is missing version or bundleUrl');
    }

    const bundle = await readRemoteJson<RemoteTemplateBundle>(manifest.bundleUrl, fetchImpl);

    if (bundle.version !== manifest.version) {
      throw new Error(`Template bundle version mismatch: expected ${manifest.version}, received ${bundle.version}`);
    }

    const rootDir = await writeBundleToCache(bundle, cacheDir);

    return {
      source: 'remote',
      rootDir,
      version: bundle.version
    };
  } catch (error) {
    return {
      source: 'bundled',
      rootDir: bundledTemplatesDir,
      version: 'bundled',
      fallbackReason: error instanceof Error ? error.message : 'Unknown remote template error'
    };
  }
}
