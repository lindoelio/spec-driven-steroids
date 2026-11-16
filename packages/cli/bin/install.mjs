#!/usr/bin/env node
/**
 * The installer of the main npm package.
 *
 * The main package ships this installer and a thin launcher; the CLI is the
 * native binary. The binary comes from the platform package the registry
 * resolved for the host, the installer copies that binary out of the package,
 * verifies it against the digest published with the package, and places it
 * only when the digest matches.
 *
 * The installer performs no network access of its own. It reads the package
 * the registry already placed on disk and writes to the file system; there is
 * no fetch, no HTTP client and no downloader in this file, so the registry is
 * the only transport and npm's own integrity check stays in the chain.
 *
 * The digest is a corruption check, not a provenance check: it travels inside
 * the package it authenticates. The provenance controls are the publisher's
 * attestation and the release-time cross-check against the GitHub Release
 * checksum.
 */
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PLACEHOLDER_DIGEST = '0'.repeat(64);
const BINARY_NAME = 'sds';
const WINDOWS_BINARY_NAME = 'sds.exe';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function warn(message) {
  console.warn(`spec-driven-steroids: ${message}`);
}

function fail(message) {
  console.error(`spec-driven-steroids: ${message}`);
  process.exit(1);
}

/**
 * The directory of an installed package, found the way node resolves one.
 *
 * The lookup walks the node_modules directories above the main package, so it
 * finds the package whether the registry hoisted it or nested it. It reads the
 * file system only.
 */
function findPackageDirectory(name) {
  let current = packageRoot;
  for (;;) {
    const candidate = join(current, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) {
      return dirname(candidate);
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * The platform package the registry resolved for this host.
 *
 * The package name is the host identity npm itself reports, so the package
 * whose name carries the host suffix is resolved first. A package that
 * declares an operating system or an architecture that does not match the
 * host is not a candidate.
 */
function resolvePlatformPackage() {
  const mainManifest = readManifest(join(packageRoot, 'package.json'));
  const candidates = Object.keys(mainManifest.optionalDependencies ?? {});
  const suffix = `${process.platform}-${process.arch}`;
  const named = candidates.filter((name) => name.endsWith(`-${suffix}`));
  const rest = candidates.filter((name) => !name.endsWith(`-${suffix}`));

  for (const name of [...named, ...rest]) {
    const directory = findPackageDirectory(name);
    if (!directory) {
      continue;
    }

    let manifest;
    try {
      manifest = readManifest(join(directory, 'package.json'));
    } catch {
      continue;
    }

    if (!appliesToHost(manifest)) {
      continue;
    }

    return { name, directory, manifest };
  }

  return undefined;
}

function appliesToHost(manifest) {
  const operatingSystems = manifest.os;
  const architectures = manifest.cpu;

  if (Array.isArray(operatingSystems) && !operatingSystems.includes(process.platform)) {
    return false;
  }
  if (Array.isArray(architectures) && !architectures.includes(process.arch)) {
    return false;
  }
  return true;
}

/**
 * The path of the binary inside the platform package.
 *
 * The path comes from the manifest of the resolved package, and it has to stay
 * inside that package: the binary is only ever taken from the package the
 * registry resolved.
 */
function resolveBinaryPath(platformPackage) {
  const bins = platformPackage.manifest.bin;
  if (!bins || typeof bins !== 'object') {
    fail(`${platformPackage.name} declares no bin entry, so it carries no binary.`);
  }

  const declared = bins[BINARY_NAME] ?? bins['spec-driven-steroids'];
  if (typeof declared !== 'string' || declared.length === 0) {
    fail(`${platformPackage.name} declares no sds bin entry.`);
  }

  const binaryPath = resolve(platformPackage.directory, declared);
  const inside = relative(platformPackage.directory, binaryPath);
  if (inside.length === 0 || inside.startsWith('..') || isAbsolute(inside)) {
    fail(`${platformPackage.name} declares a binary outside the package: ${declared}`);
  }

  return binaryPath;
}

/**
 * The SHA-256 digest of a file, computed from its bytes.
 */
async function digestOf(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function install() {
  const platformPackage = resolvePlatformPackage();
  if (!platformPackage) {
    warn(
      `no platform package was resolved for ${process.platform}-${process.arch}, so no binary was installed. ` +
        'Install the binary manually, or use the GitHub Release asset for your platform.'
    );
    return;
  }

  const digest = platformPackage.manifest.sha256;
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) {
    fail(
      `${platformPackage.name} publishes no usable sha256 digest, so the binary it carries cannot be verified. ` +
        'Nothing was installed.'
    );
  }

  const binaryPath = resolveBinaryPath(platformPackage);
  if (!existsSync(binaryPath)) {
    // A platform package that carries no binary is a workspace link, not a
    // published package: the release pipeline adds the binary before it
    // publishes. Nothing is installed, and nothing is refused.
    warn(
      `${platformPackage.name} carries no binary at ${binaryPath}, so nothing was installed. ` +
        'The release pipeline adds the binary before it publishes the package.'
    );
    return;
  }

  const actual = await digestOf(binaryPath);
  if (actual !== digest) {
    const placeholder = digest === PLACEHOLDER_DIGEST ? ' The published digest is a placeholder, so this package was not published by the release pipeline.' : '';
    fail(
      `the binary in ${platformPackage.name} has the digest ${actual}, but the package publishes ${digest}.${placeholder} ` +
        'The binary does not match the digest published with it, so it was not installed.'
    );
  }

  const destination = join(packageRoot, 'bin', process.platform === 'win32' ? WINDOWS_BINARY_NAME : BINARY_NAME);
  const temporary = `${destination}.partial`;

  try {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(binaryPath, temporary);
    chmodSync(temporary, 0o755);

    const copied = await digestOf(temporary);
    if (copied !== digest) {
      rmSync(temporary, { force: true });
      fail(
        `the copied binary has the digest ${copied}, but ${platformPackage.name} publishes ${digest}. ` +
          'Nothing was installed.'
      );
    }

    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { force: true });
    warn(`the verified binary could not be placed at ${destination}: ${error.message}`);
    warn(`the binary is still available at ${binaryPath}; link it manually with \`npm link ${platformPackage.name}\`.`);
    return;
  }

  console.log(`Installed the verified ${platformPackage.name} binary at ${destination}.`);
}

await install();
