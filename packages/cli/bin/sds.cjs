#!/usr/bin/env node
/**
 * The global command of the npm package.
 *
 * npm links the `bin` entries of the top-level package into the global
 * prefix, while the native binary the installer places lives inside this
 * package. This launcher is the bridge: it spawns the installed native
 * binary with the same arguments, so `sds` works after a global install.
 *
 * The native binary itself has no Node.js dependency; only this thin
 * launcher runs on Node.
 */
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, dirname } = require('node:path');

const packageRoot = join(dirname(__filename), '..');
const binary = join(packageRoot, 'bin', process.platform === 'win32' ? 'sds.exe' : 'sds');

if (!existsSync(binary)) {
  console.error('spec-driven-steroids: the native binary is not installed at ' + binary + '.');
  console.error('spec-driven-steroids: reinstall with install scripts enabled, or link the binary from the resolved platform package:');
  console.error('spec-driven-steroids:   npm link @lindoelio/sds-<platform>-<arch>');
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error('spec-driven-steroids: ' + result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
