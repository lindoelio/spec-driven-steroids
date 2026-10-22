import path from 'path';

export const TEMPLATE_SCHEMA_VERSION = 1;
export const MAX_TEMPLATE_FILES = 2000;
export const MAX_TEMPLATE_BUNDLE_BYTES = 5 * 1024 * 1024;
export const MAX_TEMPLATE_JSON_BYTES = 8 * 1024 * 1024;

export type TemplateErrorKind = 'invalid' | 'integrity' | 'incompatible' | 'network';

export class TemplateSourceError extends Error {
  readonly kind: TemplateErrorKind;

  constructor(message: string, kind: TemplateErrorKind = 'invalid') {
    super(message);
    this.name = 'TemplateSourceError';
    this.kind = kind;
  }
}

export interface TemplateManifest {
  schemaVersion?: number;
  version: string;
  bundleUrl: string;
  sha256?: string;
  minCliVersion?: string;
  publishedAt?: string;
}

export interface TemplateBundle {
  schemaVersion?: number;
  version: string;
  files: Record<string, string>;
}

export const TEMPLATE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TemplateSourceError(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function assertTemplateVersion(version: unknown): string {
  if (typeof version !== 'string' || !TEMPLATE_VERSION_PATTERN.test(version)) {
    throw new TemplateSourceError(
      `Invalid template version: ${String(version)}. Versions may contain only letters, digits, dot, underscore, and hyphen.`
    );
  }
  return version;
}

export function normalizeRelativeTemplatePath(relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new TemplateSourceError('Template file path must be a non-empty string');
  }

  const normalized = relativePath.replace(/\\/g, '/');

  if (normalized.includes('\0')) {
    throw new TemplateSourceError(`Invalid template path: ${relativePath}`);
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new TemplateSourceError(`Template path must be relative: ${relativePath}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new TemplateSourceError(`Invalid template path segment in: ${relativePath}`);
  }

  return segments.join('/');
}

export function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, candidate);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TemplateSourceError(`Path escapes template root: ${relativePath}`);
  }

  return candidate;
}

export function parseTemplateManifest(raw: unknown): TemplateManifest {
  const record = asRecord(raw, 'Template manifest');
  const version = assertTemplateVersion(record.version);

  if (typeof record.bundleUrl !== 'string' || record.bundleUrl.length === 0) {
    throw new TemplateSourceError('Template manifest is missing bundleUrl');
  }

  let bundleUrl: URL;
  try {
    bundleUrl = new URL(record.bundleUrl);
  } catch {
    throw new TemplateSourceError(`Template manifest bundleUrl is not a valid URL: ${record.bundleUrl}`);
  }
  if (bundleUrl.protocol !== 'https:') {
    throw new TemplateSourceError('Template manifest bundleUrl must use HTTPS');
  }

  if (record.schemaVersion !== undefined && typeof record.schemaVersion !== 'number') {
    throw new TemplateSourceError('Template manifest schemaVersion must be a number');
  }
  if (record.sha256 !== undefined && (typeof record.sha256 !== 'string' || !SHA256_PATTERN.test(record.sha256))) {
    throw new TemplateSourceError('Template manifest sha256 must be 64 lowercase hex characters');
  }
  if (record.minCliVersion !== undefined && (typeof record.minCliVersion !== 'string' || !SEMVER_PATTERN.test(record.minCliVersion))) {
    throw new TemplateSourceError('Template manifest minCliVersion must be a valid semantic version');
  }
  if (record.publishedAt !== undefined && typeof record.publishedAt !== 'string') {
    throw new TemplateSourceError('Template manifest publishedAt must be a string');
  }

  return {
    schemaVersion: record.schemaVersion as number | undefined,
    version,
    bundleUrl: bundleUrl.toString(),
    sha256: record.sha256 as string | undefined,
    minCliVersion: record.minCliVersion as string | undefined,
    publishedAt: record.publishedAt as string | undefined
  };
}

export interface ParsedTemplateBundle {
  bundle: TemplateBundle;
  entries: Array<[string, string]>;
  byteSize: number;
}

export function parseTemplateBundle(raw: unknown): ParsedTemplateBundle {
  const record = asRecord(raw, 'Template bundle');
  const version = assertTemplateVersion(record.version);

  if (record.schemaVersion !== undefined && typeof record.schemaVersion !== 'number') {
    throw new TemplateSourceError('Template bundle schemaVersion must be a number');
  }

  const files = asRecord(record.files, 'Template bundle files');
  const rawEntries = Object.entries(files);

  if (rawEntries.length === 0) {
    throw new TemplateSourceError('Template bundle does not contain any files');
  }
  if (rawEntries.length > MAX_TEMPLATE_FILES) {
    throw new TemplateSourceError(`Template bundle contains too many files (${rawEntries.length} > ${MAX_TEMPLATE_FILES})`);
  }

  let byteSize = 0;
  const entries: Array<[string, string]> = [];
  const seenPaths = new Set<string>();

  for (const [relativePath, contents] of rawEntries) {
    if (typeof contents !== 'string') {
      throw new TemplateSourceError(`Template file contents must be a string: ${relativePath}`);
    }

    const safePath = normalizeRelativeTemplatePath(relativePath);
    if (seenPaths.has(safePath)) {
      throw new TemplateSourceError(`Template bundle contains a duplicate path: ${safePath}`);
    }
    seenPaths.add(safePath);
    byteSize += Buffer.byteLength(contents, 'utf8');

    if (byteSize > MAX_TEMPLATE_BUNDLE_BYTES) {
      throw new TemplateSourceError(`Template bundle exceeds maximum size of ${MAX_TEMPLATE_BUNDLE_BYTES} bytes`);
    }

    entries.push([safePath, contents]);
  }

  return {
    bundle: {
      schemaVersion: record.schemaVersion as number | undefined,
      version,
      files: Object.fromEntries(entries)
    },
    entries,
    byteSize
  };
}

export function compareSemver(left: string, right: string): number {
  const [leftCore, leftPre] = left.split('-', 2);
  const [rightCore, rightPre] = right.split('-', 2);
  const leftParts = leftCore.split('.').map(Number);
  const rightParts = rightCore.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }

  if (!leftPre && rightPre) return 1;
  if (leftPre && !rightPre) return -1;
  if (!leftPre && !rightPre) return 0;

  return leftPre.localeCompare(rightPre);
}

export function assertCompatibleSchema(schemaVersion: number | undefined, label: string): void {
  if (schemaVersion !== undefined && schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    throw new TemplateSourceError(
      `${label} schema version ${schemaVersion} is not supported by this CLI (expected ${TEMPLATE_SCHEMA_VERSION})`,
      'incompatible'
    );
  }
}

export function isAllowedBundleHost(hostname: string, manifestHostname: string): boolean {
  const normalized = hostname.toLowerCase();
  const manifestHost = manifestHostname.toLowerCase();

  if (normalized === manifestHost) return true;
  if (normalized === 'github.com') return true;
  if (normalized.endsWith('.githubusercontent.com')) return true;

  const configuredHosts = (process.env.SDS_TEMPLATE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return configuredHosts.includes(normalized);
}
