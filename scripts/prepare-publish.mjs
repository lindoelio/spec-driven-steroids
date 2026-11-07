#!/usr/bin/env node
/**
 * Prepares the main package for publication.
 *
 * In the repository the main package declares its platform packages with the
 * workspace protocol, so that the monorepo resolves them locally. The
 * published package has to name the concrete versions the registry holds, so
 * this script rewrites the specifiers to the declared version.
 *
 * Usage: node scripts/prepare-publish.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.resolve(root, 'packages/cli/package.json');
const version = fs.readFileSync(path.resolve(root, 'VERSION'), 'utf8').trim();

if (!version) {
  console.error('Could not resolve the declared version from VERSION.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const optional = manifest.optionalDependencies ?? {};

let rewritten = 0;
for (const [name, specifier] of Object.entries(optional)) {
  if (specifier === `workspace:*` || specifier === 'workspace:^' || specifier === 'workspace:~') {
    optional[name] = version;
    rewritten += 1;
  }
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared the main package: ${rewritten} platform package specifier(s) now name ${version}.`);
