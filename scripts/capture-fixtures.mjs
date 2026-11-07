#!/usr/bin/env node
/**
 * Captures the behavioral fixtures of the product.
 *
 * The fixtures record what the shipped implementation produces, so that the
 * Go implementation can be checked against a captured contract rather than
 * against its own reading of the specification.
 *
 * The command surface fixtures live in internal/testdata/fixtures/command-surface.
 * This script captures the artifact fixtures: for every platform and scope, the
 * paths the platform receives and the bytes of each one, plus the inventory of
 * the canonical tree.
 *
 * Usage: node scripts/capture-fixtures.mjs [--oracle <path>]
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const oracleArgument = process.argv.indexOf('--oracle');
const oracle = oracleArgument === -1
  ? path.resolve(root, 'packages/cli/dist/cli/index.js')
  : path.resolve(root, process.argv[oracleArgument + 1]);
const outDir = path.resolve(root, 'internal/testdata/fixtures/artifacts');

/**
 * The platform root and the skills root of every platform and scope, relative
 * to the home directory (user scope) or to the working directory (project
 * scope). A platform whose root is the artifact root reads the canonical tree
 * directly under the new layout, which the native flag records.
 */
const PLATFORMS = [
  {
    id: 'antigravity',
    scopes: {
      global: { root: '.gemini/config', skills: '.gemini/config/skills' },
      project: { root: '.agents', skills: '.agents/skills', native: true }
    }
  },
  {
    id: 'antigravity-cli',
    scopes: {
      global: { root: '.gemini/antigravity-cli', skills: '.gemini/antigravity-cli/skills' },
      project: { root: '.agents', skills: '.agents/skills', native: true }
    }
  },
  {
    id: 'claudecode',
    scopes: { project: { root: '.claude', skills: '.claude/skills' } }
  },
  {
    id: 'cline',
    scopes: {
      global: { root: '.cline', skills: '.cline/skills' },
      project: { root: '.cline', skills: '.cline/skills' }
    }
  },
  {
    id: 'codex',
    scopes: { project: { root: '.codex', skills: '.codex/skills' } }
  },
  {
    id: 'gemini-cli',
    scopes: {
      global: { root: '.gemini', skills: '.gemini/skills' },
      project: { root: '.gemini', skills: '.gemini/skills' }
    }
  },
  {
    id: 'github-copilot-cli',
    scopes: {
      global: { root: '.config/github-copilot', skills: '.config/github-copilot/skills' },
      project: { root: '.github', skills: '.github/skills' }
    }
  },
  {
    id: 'github-jetbrains',
    scopes: { project: { root: '.github', skills: '.github/skills' } }
  },
  {
    id: 'github-vscode',
    scopes: {
      global: { root: '.config/Code/User/prompts', skills: '.copilot/skills' },
      project: { root: '.github', skills: '.github/skills' }
    }
  },
  {
    id: 'minimax-code',
    scopes: {
      global: { root: '.agents', skills: '.agents/skills', native: true },
      project: { root: '.minimax', skills: '.minimax/skills' }
    }
  },
  {
    id: 'opencode',
    scopes: {
      global: { root: '.config/opencode', skills: '.config/opencode/skills' },
      project: { root: '.opencode', skills: '.opencode/skills' }
    }
  },
  {
    id: 'qoder',
    scopes: {
      global: { root: '.qoder', skills: '.qoder/skills' },
      project: { root: '.qoder', skills: '.qoder/skills' }
    }
  },
  {
    id: 'qwen-code',
    scopes: {
      global: { root: '.qwen', skills: '.qwen/skills' },
      project: { root: '.qwen', skills: '.qwen/skills' }
    }
  }
];

function walk(directory, base = directory) {
  const files = [];
  if (!fs.existsSync(directory)) {
    return files;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, base));
      continue;
    }
    files.push({ relative: path.relative(base, full), full });
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function capture(platform, scope, declaration) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-fixture-work-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-fixture-home-'));

  const environment = {
    ...process.env,
    HOME: homeDir,
    XDG_CONFIG_HOME: path.join(homeDir, '.config'),
    XDG_CACHE_HOME: path.join(homeDir, '.cache')
  };

  execFileSync('node', [
    oracle,
    'inject',
    '--platform', platform,
    '--scope', scope,
    '--yes',
    '--templates', 'bundled'
  ], { cwd: workDir, env: environment, stdio: 'pipe' });

  const base = scope === 'global' ? homeDir : workDir;
  const files = [];

  const rootPath = path.join(base, declaration.root);
  const skillsRootPath = path.join(base, declaration.skills);
  const skillsRelative = path.relative(rootPath, skillsRootPath);
  const skillsInsideRoot = !skillsRelative.startsWith('..') && skillsRelative !== '';

  for (const [name, relative] of [['root', declaration.root], ['skills', declaration.skills]]) {
    const rootPath = path.join(base, relative);
    for (const file of walk(rootPath)) {
      const relativePath = file.relative.split(path.sep).join('/');

      // A file below the skills root belongs to the skills root, so that the
      // fixture names it once.
      if (name === 'root' && skillsInsideRoot && (relativePath === skillsRelative || relativePath.startsWith(`${skillsRelative}/`))) {
        continue;
      }

      const content = fs.readFileSync(file.full);
      const entry = {
        root: name,
        path: relativePath,
        sha256: sha256(content),
        bytes: content.length
      };

      // The derived artifacts carry their bytes; a copied skill tree is
      // recorded by its digest, because its content is the canonical tree.
      if (name !== 'skills') {
        entry.content = content.toString('base64');
      }

      files.push(entry);
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });

  return {
    platform,
    scope,
    native: declaration.native === true,
    roots: { root: declaration.root, skills: declaration.skills },
    files
  };
}

function captureCanonicalTree() {
  const templates = path.resolve(root, 'internal/assets/canonical');
  const files = walk(templates).map((file) => {
    const content = fs.readFileSync(file.full);
    return {
      path: file.relative.split(path.sep).join('/'),
      sha256: sha256(content),
      bytes: content.length
    };
  });
  return { root: 'canonical', files };
}

if (!fs.existsSync(oracle)) {
  console.error(`The oracle is not built: ${oracle}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

for (const platform of PLATFORMS) {
  for (const [scope, declaration] of Object.entries(platform.scopes)) {
    const captured = capture(platform.id, scope, declaration);
    const file = path.join(outDir, `${platform.id}-${scope}.json`);
    fs.writeFileSync(file, `${JSON.stringify(captured, null, 2)}\n`);
    console.log(`captured ${platform.id}/${scope}: ${captured.files.length} file(s)`);
  }
}

const canonical = captureCanonicalTree();
fs.writeFileSync(
  path.join(outDir, 'canonical-tree.json'),
  `${JSON.stringify(canonical, null, 2)}\n`
);
console.log(`captured the canonical tree: ${canonical.files.length} file(s)`);
