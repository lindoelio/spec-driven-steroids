import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const packageDir = path.join(repoRoot, 'packages', 'cli');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-pack-check-'));

try {
  const packOutput = execFileSync('npm', ['pack', '--pack-destination', tempDir, '--json'], {
    cwd: packageDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

  const [packResult] = JSON.parse(packOutput);
  const tarballPath = path.join(tempDir, packResult.filename);
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`npm pack did not create ${tarballPath}`);
  }

  const files = new Set(packResult.files.map(file => file.path));
  const requiredFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'dist/cli/index.js',
    'templates/universal/agents/spec-driven.agent.md',
    'templates/universal/skills/spec-driven-planner/SKILL.md',
    'templates/universal/skills/spec-driven-planner/references/lane-selection.md',
    'templates/universal/skills/spec-driven-planner/references/full-lane-phases.md'
  ];

  for (const required of requiredFiles) {
    if (!files.has(required)) {
      throw new Error(`Published package is missing required file: ${required}`);
    }
  }

  const installPrefix = path.join(tempDir, 'install');
  execFileSync('npm', ['install', '--prefix', installPrefix, '--no-audit', '--no-fund', tarballPath], {
    stdio: ['ignore', 'inherit', 'inherit']
  });

  const installedCli = path.join(installPrefix, 'node_modules', 'spec-driven-steroids', 'dist', 'cli', 'index.js');
  if (!fs.existsSync(installedCli)) {
    throw new Error('Installed tarball is missing dist/cli/index.js');
  }

  const version = execFileSync(process.execPath, [installedCli, '--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  }).trim();

  if (!version) {
    throw new Error('Installed CLI did not report a version');
  }

  console.log(`pack:check passed (${packResult.entryCount} files, version ${version})`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
