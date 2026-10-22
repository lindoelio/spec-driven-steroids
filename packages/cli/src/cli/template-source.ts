import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  MAX_TEMPLATE_JSON_BYTES,
  TemplateSourceError,
  assertCompatibleSchema,
  assertTemplateVersion,
  compareSemver,
  isAllowedBundleHost,
  normalizeRelativeTemplatePath,
  parseTemplateBundle,
  parseTemplateManifest,
  resolveInside,
  type ParsedTemplateBundle,
  type TemplateManifest,
  type TemplateErrorKind
} from './template-bundle.js';

const DEFAULT_TEMPLATE_MANIFEST_URL = 'https://github.com/lindoelio/spec-driven-steroids/releases/download/templates-latest/templates-manifest.json';
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_RETENTION = 3;

export type TemplateSourceKind = 'bundled' | 'remote';

export interface TemplateSourceResolution {
  source: TemplateSourceKind;
  rootDir: string;
  version: string;
  fallbackReason?: string;
  errorKind?: TemplateErrorKind;
  sha256?: string;
  warnings: string[];
}

export interface ResolveTemplateSourceOptions {
  bundledTemplatesDir: string;
  cliVersion?: string;
  cacheDir?: string;
  manifestUrl?: string;
  fetchImpl?: typeof fetch;
  source?: TemplateSourceKind;
}

interface RemoteJsonResult<T> {
  data: T;
  text: string;
}

interface CacheMarker {
  sha256: string;
  version: string;
  extractedAt: string;
  files?: Record<string, string>;
}

function getDefaultCacheDir(): string {
  if (process.env.SDS_TEMPLATE_CACHE_DIR) {
    return process.env.SDS_TEMPLATE_CACHE_DIR;
  }

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'spec-driven-steroids', 'templates');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'spec-driven-steroids', 'templates');
  }

  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'spec-driven-steroids', 'templates');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

async function hashFile(filePath: string): Promise<string> {
  const contents = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function listRelativeFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listRelativeFiles(root, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function readRemoteJson<T>(url: string, fetchImpl: typeof fetch): Promise<RemoteJsonResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': 'spec-driven-steroids',
        accept: 'application/json'
      }
    });
  } catch (error) {
    throw new TemplateSourceError(
      `Template request failed: ${error instanceof Error ? error.message : String(error)}`,
      'network'
    );
  }

  if (!response.ok) {
    throw new TemplateSourceError(`Template request failed: ${response.status} ${response.statusText}`, 'network');
  }

  const contentLength = Number(response.headers?.get?.('content-length') ?? 0);
  if (contentLength > MAX_TEMPLATE_JSON_BYTES) {
    throw new TemplateSourceError(`Template response exceeds ${MAX_TEMPLATE_JSON_BYTES} bytes`, 'invalid');
  }

  let text: string;
  try {
    text = typeof response.text === 'function'
      ? await response.text()
      : JSON.stringify(await response.json());
  } catch (error) {
    throw new TemplateSourceError(
      `Unable to read template response: ${error instanceof Error ? error.message : String(error)}`,
      'network'
    );
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_TEMPLATE_JSON_BYTES) {
    throw new TemplateSourceError(`Template response exceeds ${MAX_TEMPLATE_JSON_BYTES} bytes`, 'invalid');
  }

  try {
    return { data: JSON.parse(text) as T, text };
  } catch (error) {
    throw new TemplateSourceError(
      `Template response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'invalid'
    );
  }
}

function markerPath(versionDir: string): string {
  return path.join(versionDir, '.sds-template-bundle.json');
}

async function readCacheMarker(versionDir: string): Promise<CacheMarker | null> {
  try {
    return await fs.readJson(markerPath(versionDir)) as CacheMarker;
  } catch {
    return null;
  }
}

async function isValidCachedBundle(cacheDir: string, manifest: TemplateManifest): Promise<string | null> {
  if (!manifest.sha256) return null;
  const versionDir = resolveInside(cacheDir, manifest.version);
  const marker = await readCacheMarker(versionDir);
  if (!marker || marker.sha256 !== manifest.sha256 || !marker.files) return null;
  const templatesDir = path.join(versionDir, 'templates');
  if (!await fs.pathExists(templatesDir)) return null;

  const expectedFiles = Object.keys(marker.files).sort();
  let actualFiles: string[];
  try {
    actualFiles = (await listRelativeFiles(templatesDir)).sort();
  } catch {
    return null;
  }

  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    return null;
  }

  for (const relativePath of expectedFiles) {
    try {
      const digest = await hashFile(resolveInside(templatesDir, relativePath));
      if (digest !== marker.files[relativePath]) return null;
    } catch {
      return null;
    }
  }

  return templatesDir;
}

async function pruneCache(cacheDir: string, keepVersionDir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(cacheDir);
  } catch {
    return;
  }

  const candidates: Array<{ dir: string; version: string; mtime: number }> = [];
  for (const entry of entries) {
    if (entry === path.basename(keepVersionDir) || entry.startsWith('.tmp-')) continue;
    const dir = path.join(cacheDir, entry);
    const marker = await readCacheMarker(dir);
    if (!marker) continue;
    try {
      const stats = await fs.stat(dir);
      candidates.push({ dir, version: entry, mtime: stats.mtimeMs });
    } catch {
      // Ignore races with concurrent cleanup.
    }
  }

  candidates.sort((left, right) => right.mtime - left.mtime);
  for (const candidate of candidates.slice(CACHE_RETENTION - 1)) {
    await fs.remove(candidate.dir).catch(() => undefined);
  }
}

async function extractBundleToCache(
  cacheDir: string,
  parsed: ParsedTemplateBundle,
  digest: string
): Promise<string> {
  const version = assertTemplateVersion(parsed.bundle.version);
  const versionDir = resolveInside(cacheDir, version);
  const templatesDir = path.join(versionDir, 'templates');

  const cachedTemplatesDir = await isValidCachedBundle(cacheDir, {
    version,
    bundleUrl: '',
    sha256: digest
  });
  if (cachedTemplatesDir) {
    return cachedTemplatesDir;
  }

  await fs.ensureDir(cacheDir);
  const tempDir = path.join(
    cacheDir,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  try {
    const tempTemplatesDir = path.join(tempDir, 'templates');
    await fs.ensureDir(tempTemplatesDir);

    const fileDigests: Record<string, string> = {};
    for (const [relativePath, contents] of parsed.entries) {
      const safePath = normalizeRelativeTemplatePath(relativePath);
      const destination = resolveInside(tempTemplatesDir, safePath);
      await fs.ensureDir(path.dirname(destination));
      await fs.writeFile(destination, contents, 'utf8');
      fileDigests[safePath] = sha256(contents);
    }

    await fs.writeJson(
      path.join(tempDir, '.sds-template-bundle.json'),
      { sha256: digest, version, extractedAt: new Date().toISOString(), files: fileDigests } satisfies CacheMarker,
      { spaces: 2 }
    );

    await fs.remove(versionDir);
    await fs.move(tempDir, versionDir, { overwrite: true });
    await pruneCache(cacheDir, versionDir);

    return templatesDir;
  } catch (error) {
    await fs.remove(tempDir).catch(() => undefined);
    throw error;
  }
}

export async function resolveTemplateSource(options: ResolveTemplateSourceOptions): Promise<TemplateSourceResolution> {
  const configuredSource = process.env.SDS_TEMPLATE_SOURCE
    ?? (process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES === 'true' ? 'bundled' : 'remote');

  const {
    bundledTemplatesDir,
    cliVersion = process.env.SDS_CLI_VERSION ?? '0.0.0',
    cacheDir = getDefaultCacheDir(),
    manifestUrl = process.env.SDS_TEMPLATE_MANIFEST_URL ?? DEFAULT_TEMPLATE_MANIFEST_URL,
    fetchImpl = fetch,
    source = configuredSource as TemplateSourceKind
  } = options;

  const warnings: string[] = [];

  if (source === 'bundled') {
    return {
      source: 'bundled',
      rootDir: bundledTemplatesDir,
      version: 'bundled',
      fallbackReason: 'SDS_TEMPLATE_SOURCE is set to bundled',
      warnings
    };
  }

  try {
    const manifestResult = await readRemoteJson<unknown>(manifestUrl, fetchImpl);
    const manifest = parseTemplateManifest(manifestResult.data);

    let manifestHost: string;
    try {
      manifestHost = new URL(manifestUrl).hostname;
    } catch {
      throw new TemplateSourceError(`Manifest URL is not a valid URL: ${manifestUrl}`, 'invalid');
    }

    const bundleUrl = new URL(manifest.bundleUrl);
    if (!isAllowedBundleHost(bundleUrl.hostname, manifestHost)) {
      throw new TemplateSourceError(
        `Template bundle host is not allowed: ${bundleUrl.hostname}. Set SDS_TEMPLATE_ALLOWED_HOSTS to override.`,
        'invalid'
      );
    }

    assertCompatibleSchema(manifest.schemaVersion, 'Template manifest');

    if (manifest.minCliVersion && compareSemver(cliVersion, manifest.minCliVersion) < 0) {
      throw new TemplateSourceError(
        `Template bundle requires CLI ${manifest.minCliVersion} or newer (running ${cliVersion})`,
        'incompatible'
      );
    }

    const cached = await isValidCachedBundle(cacheDir, manifest);
    if (cached) {
      warnings.push('Using cached template bundle.');
      return {
        source: 'remote',
        rootDir: cached,
        version: manifest.version,
        sha256: manifest.sha256,
        warnings
      };
    }

    const bundleResult = await readRemoteJson<unknown>(manifest.bundleUrl, fetchImpl);
    const digest = sha256(bundleResult.text);

    if (manifest.sha256 && digest !== manifest.sha256) {
      throw new TemplateSourceError(
        `Template bundle digest mismatch: expected ${manifest.sha256}, received ${digest}`,
        'integrity'
      );
    }

    const parsed = parseTemplateBundle(bundleResult.data);
    if (parsed.bundle.version !== manifest.version) {
      throw new TemplateSourceError(
        `Template bundle version mismatch: expected ${manifest.version}, received ${parsed.bundle.version}`,
        'incompatible'
      );
    }
    assertCompatibleSchema(parsed.bundle.schemaVersion, 'Template bundle');

    const rootDir = await extractBundleToCache(cacheDir, parsed, digest);

    if (!manifest.sha256) {
      warnings.push('Remote template manifest has no sha256 digest; integrity could not be verified.');
    }

    return {
      source: 'remote',
      rootDir,
      version: parsed.bundle.version,
      sha256: digest,
      warnings
    };
  } catch (error) {
    const templateError = error instanceof TemplateSourceError
      ? error
      : new TemplateSourceError(error instanceof Error ? error.message : String(error), 'invalid');

    return {
      source: 'bundled',
      rootDir: bundledTemplatesDir,
      version: 'bundled',
      fallbackReason: templateError.message,
      errorKind: templateError.kind,
      warnings
    };
  }
}
