import crypto from 'crypto';
import fs from 'fs-extra';
import type { Dirent } from 'fs';
import os from 'os';
import path from 'path';

import type { InjectionScope } from './platform-registry.js';

export interface InstalledFile {
  path: string;
  sha256: string;
}

export interface InstallManifest {
  version: 1;
  platform: string;
  scope: InjectionScope;
  root: string;
  skillsRoot: string;
  cliVersion: string;
  templateVersion: string;
  installedAt: string;
  files: InstalledFile[];
}

export interface ManifestCleanResult {
  removed: string[];
  skipped: string[];
  missing: string[];
}

export function getConfigDir(): string {
  if (process.env.SDS_CONFIG_DIR) return process.env.SDS_CONFIG_DIR;

  if (process.platform === 'win32') {
    const base = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'spec-driven-steroids');
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'spec-driven-steroids');
  }

  return path.join(os.homedir(), '.config', 'spec-driven-steroids');
}

export function getInstallDir(): string {
  return path.join(getConfigDir(), 'installs');
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function getManifestPath(platform: string, scope: InjectionScope, projectRoot?: string): string {
  const projectKey = scope === 'global' ? 'global' : hash(path.resolve(projectRoot ?? process.cwd()));
  return path.join(getInstallDir(), `${platform}-${scope}-${projectKey}.json`);
}

export async function readManifest(manifestPath: string): Promise<InstallManifest | null> {
  try {
    const manifest = await fs.readJson(manifestPath) as InstallManifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.files)) return null;
    return manifest;
  } catch {
    return null;
  }
}

export async function listManifests(): Promise<InstallManifest[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(getInstallDir());
  } catch {
    return [];
  }

  const manifests: InstallManifest[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const manifest = await readManifest(path.join(getInstallDir(), entry));
    if (manifest) manifests.push(manifest);
  }
  return manifests;
}

export async function writeManifest(manifest: InstallManifest): Promise<string> {
  const manifestPath = getManifestPath(manifest.platform, manifest.scope, manifest.root);
  await fs.ensureDir(path.dirname(manifestPath));
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  return manifestPath;
}

export async function removeManifest(manifest: InstallManifest): Promise<void> {
  await fs.remove(getManifestPath(manifest.platform, manifest.scope, manifest.root)).catch(() => undefined);
}

export async function hashFile(filePath: string): Promise<string> {
  const contents = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

export async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  await walk(root);
  return files;
}

export async function buildInstalledFiles(files: string[]): Promise<InstalledFile[]> {
  const unique = [...new Set(files.map(file => path.resolve(file)))].sort();
  const installed: InstalledFile[] = [];

  for (const file of unique) {
    if (!await fs.pathExists(file)) continue;
    installed.push({ path: file, sha256: await hashFile(file) });
  }

  return installed;
}

async function removeEmptyParents(filePath: string, stopAt: string[]): Promise<void> {
  const stops = new Set(stopAt.map(directory => path.resolve(directory)));
  let current = path.dirname(path.resolve(filePath));

  while (!stops.has(current)) {
    const remaining = await fs.readdir(current).catch(() => []);
    if (remaining.length > 0) break;
    await fs.remove(current).catch(() => undefined);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function cleanManifest(
  manifest: InstallManifest,
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<ManifestCleanResult> {
  const removed: string[] = [];
  const skipped: string[] = [];
  const missing: string[] = [];

  for (const file of manifest.files) {
    if (!await fs.pathExists(file.path)) {
      missing.push(file.path);
      continue;
    }

    const digest = await hashFile(file.path);
    if (!options.force && digest !== file.sha256) {
      skipped.push(file.path);
      continue;
    }

    if (!options.dryRun) {
      await fs.remove(file.path);
      await removeEmptyParents(file.path, [manifest.root, manifest.skillsRoot]);
    }
    removed.push(file.path);
  }

  if (!options.dryRun && skipped.length === 0) {
    await removeManifest(manifest);
  }

  return { removed, skipped, missing };
}
