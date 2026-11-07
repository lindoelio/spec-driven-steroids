#!/usr/bin/env node
/**
 * Builds the native binary, stamping the declared version into it.
 *
 * The version is declared once, in the VERSION file at the repository root.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = fs.readFileSync(path.resolve(root, 'VERSION'), 'utf8').trim();
const outputDir = process.argv[2] ?? path.resolve(root, 'dist');
// Windows only runs a program whose name carries the extension, so the
// binary is named there the way the platform package names it.
const binaryName = process.platform === 'win32' ? 'sds.exe' : 'sds';
const output = path.join(outputDir, binaryName);

execFileSync('go', [
  'build',
  '-trimpath',
  '-ldflags', `-s -w -X github.com/lindoelio/spec-driven-steroids/internal/version.Version=${version}`,
  '-o', output,
  './cmd/sds'
], { stdio: 'inherit', cwd: root });

console.log(`Built ${output} (version ${version}).`);
