#!/usr/bin/env node
/**
 * The single write path for the declared version.
 *
 * The version is declared once, in the VERSION file at the repository root.
 * This script updates that declaration and every place that derives from it:
 * the embedded copy the binary carries and the npm package manifests. The
 * release tag is derived from the declaration when the release is tagged.
 *
 * Usage: node scripts/set-version.mjs <version>
 */
import fs from 'node:fs';
import path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const root = process.cwd();
const versionPath = path.resolve(root, 'VERSION');
const embeddedPath = path.resolve(root, 'internal/version/VERSION');

const requested = process.argv[2]?.trim();
if (!requested) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  process.exit(1);
}
if (!SEMVER.test(requested)) {
  console.error(`"${requested}" is not a valid semantic version.`);
  process.exit(1);
}

fs.writeFileSync(versionPath, `${requested}\n`);
fs.writeFileSync(embeddedPath, `${requested}\n`);

for (const manifestPath of [
  path.resolve(root, 'package.json'),
  path.resolve(root, 'packages/cli/package.json'),
  ...platformManifestPaths()
]) {
  if (!fs.existsSync(manifestPath)) {
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = requested;
  // The workspace protocol stays in the repository: the platform packages are
  // published from the same release, so the concrete version only replaces it
  // at publication time, in scripts/prepare-publish.mjs.
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, indentationOf(manifestPath))}\n`);
}

console.log(`Declared version is now ${requested}.`);

// The platform packages are the npm manifests of the release binaries, one per
// operating system and architecture pair.
function platformManifestPaths() {
  const platformRoot = path.resolve(root, 'packages/platform');
  if (!fs.existsSync(platformRoot)) {
    return [];
  }
  return fs
    .readdirSync(platformRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(platformRoot, entry.name, 'package.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath));
}

// The indentation of a manifest is kept, so a version bump does not reformat
// a file that was written in another style.
function indentationOf(manifestPath) {
  const match = /\n(\s+)"/.exec(fs.readFileSync(manifestPath, 'utf8'));
  return match ? match[1] : '  ';
}
