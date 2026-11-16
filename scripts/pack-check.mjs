#!/usr/bin/env node
/**
 * Checks the published package.
 *
 * The main package carries the installer and a thin launcher; the CLI is the
 * native binary, and it comes from the platform package the registry resolved
 * for the host. The check therefore verifies three things: the shape of the
 * main package, the shape of every platform package, and the trust boundary
 * of the installer — a matching digest places the binary, a mismatching
 * digest refuses it.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const packageDir = path.join(repoRoot, 'packages', 'cli');
const platformDir = path.join(repoRoot, 'packages', 'platform');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-pack-check-'));

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pack(directory, destination) {
  const output = execFileSync('npm', ['pack', '--pack-destination', destination, '--json'], {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const [result] = JSON.parse(output);
  return result;
}

try {
  const mainPackage = readJson(path.join(packageDir, 'package.json'));
  const declaredVersion = fs.readFileSync(path.join(repoRoot, 'VERSION'), 'utf8').trim();

  // The main package carries no runtime dependency, but it does declare the
  // global command: the launcher bridges npm's bin link to the installed
  // native binary.
  if (mainPackage.main) {
    fail('The main package must not declare a JavaScript entrypoint.');
  }
  if (!mainPackage.bin?.sds || !mainPackage.bin?.['spec-driven-steroids']) {
    fail('The main package must declare the sds and spec-driven-steroids bin commands.');
  }
  if (mainPackage.bin.sds !== 'bin/sds.cjs' || mainPackage.bin['spec-driven-steroids'] !== 'bin/sds.cjs') {
    fail('The main package bin commands must point at the launcher bin/sds.cjs.');
  }
  if (mainPackage.dependencies) {
    fail('The main package must not declare a runtime dependency.');
  }

  const packResult = pack(packageDir, tempDir);
  const files = new Set(packResult.files.map((file) => file.path));
  for (const required of ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'bin/install.mjs', 'bin/sds.cjs']) {
    if (!files.has(required)) {
      fail(`The published package is missing required file: ${required}`);
    }
  }
  for (const forbidden of ['dist/cli/index.js', 'templates/universal/agents/spec-driven.agent.md', 'bin/sds', 'bin/sds.exe']) {
    if (files.has(forbidden)) {
      fail(`The published package must not carry the file: ${forbidden}.`);
    }
  }

  // Every platform package declares the operating system and the architecture
  // it applies to, and the digest of the binary it carries.
  const platformPackages = fs
    .readdirSync(platformDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(platformDir, entry.name));

  if (platformPackages.length === 0) {
    fail('No platform package was found.');
  }

  const declared = mainPackage.optionalDependencies ?? {};

  // The supported matrix is fixed: a pair that is missing never resolves for
  // the host it belongs to.
  const supportedPairs = [
    'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'win32-x64', 'win32-arm64',
  ];
  const present = platformPackages.map((directory) => path.basename(directory));
  for (const pair of supportedPairs) {
    if (!present.includes(pair)) {
      fail(`The platform package for ${pair} is missing.`);
    }
  }
  for (const directory of platformPackages) {
    const manifest = readJson(path.join(directory, 'package.json'));
    if (!manifest.os?.length || !manifest.cpu?.length) {
      fail(`The platform package ${manifest.name} declares no operating system or architecture.`);
    }
    // The operating system and the architecture have to match the package
    // they belong to, or the registry resolves a package for a host that
    // cannot run it.
    const [operatingSystem, architecture] = path.basename(directory).split('-');
    if (manifest.os.length !== 1 || manifest.os[0] !== operatingSystem) {
      fail(`The platform package ${manifest.name} declares the operating system ${manifest.os.join(', ')}, want ${operatingSystem}.`);
    }
    if (manifest.cpu.length !== 1 || manifest.cpu[0] !== architecture) {
      fail(`The platform package ${manifest.name} declares the architecture ${manifest.cpu.join(', ')}, want ${architecture}.`);
    }
    // The repository ships the placeholder; the release fills it with the
    // digest of the binary. Both are well formed, and the installer refuses
    // the placeholder, which the trust boundary below checks.
    const digest = manifest.sha256 ?? '';
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      fail(`The platform package ${manifest.name} declares no valid digest.`);
    }
    if (!declared[manifest.name]) {
      fail(`The main package does not declare the platform package ${manifest.name}.`);
    }
    if (manifest.version !== declaredVersion) {
      fail(`The platform package ${manifest.name} declares the version ${manifest.version}, want ${declaredVersion}.`);
    }
    if (declared[manifest.name] !== `workspace:*` && declared[manifest.name] !== manifest.version) {
      fail(`The main package declares ${manifest.name}@${declared[manifest.name]}, want ${manifest.version}.`);
    }
  }

  for (const name of Object.keys(declared)) {
    const known = platformPackages.some(
      (directory) => readJson(path.join(directory, 'package.json')).name === name
    );
    if (!known) {
      fail(`The main package declares an unknown platform package: ${name}`);
    }
  }

  // The trust boundary: a matching digest places the binary, a mismatching
  // digest refuses it.
  const layout = path.join(tempDir, 'layout', 'node_modules');
  const installedMain = path.join(layout, 'spec-driven-steroids');
  fs.mkdirSync(path.join(installedMain, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(installedMain, 'package.json'), JSON.stringify(mainPackage, null, 2));
  fs.copyFileSync(path.join(packageDir, 'bin', 'install.mjs'), path.join(installedMain, 'bin', 'install.mjs'));

  const hostPackage = platformPackages.find((directory) => {
    const manifest = readJson(path.join(directory, 'package.json'));
    const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
    return manifest.os.includes(process.platform) && manifest.cpu.includes(architecture);
  });
  if (!hostPackage) {
    fail(`No platform package matches ${process.platform}-${process.arch}.`);
  }

  const hostManifest = readJson(path.join(hostPackage, 'package.json'));
  const binaryName = process.platform === 'win32' ? 'sds.exe' : 'sds';
  const placed = path.join(installedMain, 'bin', binaryName);
  const binaryContent = Buffer.from('#!/bin/sh\necho "sds"\n');
  const realDigest = crypto.createHash('sha256').update(binaryContent).digest('hex');

  const placePlatformPackage = (digest) => {
    const target = path.join(layout, hostManifest.name);
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.join(target, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ ...hostManifest, sha256: digest }, null, 2));
    fs.writeFileSync(path.join(target, 'bin', binaryName), binaryContent, { mode: 0o755 });
  };

  const installer = path.join(installedMain, 'bin', 'install.mjs');
  fs.copyFileSync(path.join(packageDir, 'bin', 'sds.cjs'), path.join(installedMain, 'bin', 'sds.cjs'));
  const launcher = path.join(installedMain, 'bin', 'sds.cjs');
  const runInstaller = () =>
    execFileSync(process.execPath, [installer], {
      cwd: installedMain,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

  // A mismatching digest is refused and nothing is placed.
  placePlatformPackage('f'.repeat(64));
  let refused = false;
  try {
    runInstaller();
  } catch {
    refused = true;
  }
  if (!refused) {
    fail('The installer accepted a binary whose digest does not match.');
  }
  if (fs.existsSync(placed)) {
    fail('The installer placed a binary whose digest does not match.');
  }

  // The placeholder digest the repository ships is refused as well: a
  // placeholder is not a digest.
  placePlatformPackage('0'.repeat(64));
  let placeholderRefused = false;
  try {
    runInstaller();
  } catch {
    placeholderRefused = true;
  }
  if (!placeholderRefused) {
    fail('The installer accepted the placeholder digest.');
  }
  if (fs.existsSync(placed)) {
    fail('The installer placed a binary under the placeholder digest.');
  }

  // A matching digest places the binary.
  placePlatformPackage(realDigest);
  runInstaller();
  if (!fs.existsSync(placed)) {
    fail('The installer did not place the binary.');
  }
  const placedDigest = crypto.createHash('sha256').update(fs.readFileSync(placed)).digest('hex');
  if (placedDigest !== realDigest) {
    fail('The placed binary does not carry the published digest.');
  }

  // The launcher bridges npm's bin link to the placed native binary. The
  // fixture binary is a shell script, so the exec path only runs where the
  // shell script is executable; the digest checks above cover Windows.
  if (process.platform !== 'win32') {
    const launched = execFileSync(process.execPath, [launcher], {
      cwd: installedMain,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (!launched.includes('sds')) {
      fail('The launcher did not run the placed binary.');
    }
  }

  // Without a placed binary the launcher refuses instead of running nothing.
  fs.rmSync(placed, { force: true });
  let launcherRefused = false;
  try {
    execFileSync(process.execPath, [launcher], {
      cwd: installedMain,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    launcherRefused = true;
  }
  if (!launcherRefused) {
    fail('The launcher ran without an installed binary.');
  }

  console.log(
    `pack:check passed (${packResult.entryCount} files in the main package, ${platformPackages.length} platform packages, installer trust boundary verified)`
  );
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
