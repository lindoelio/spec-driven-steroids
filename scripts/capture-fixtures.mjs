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
 * Usage: node scripts/capture-fixtures.mjs [--oracle <path> | --native]
 *
 * The oracle mode captures through the TypeScript implementation. The native
 * mode captures through the Go binary the repository builds, and is the mode
 * for every capture after the TypeScript removal: the fixtures are the
 * regression baseline of the native implementation.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const native = process.argv.includes('--native');
const oracleArgument = process.argv.indexOf('--oracle');
const oracle = oracleArgument === -1
  ? path.resolve(root, 'packages/cli/dist/cli/index.js')
  : path.resolve(root, process.argv[oracleArgument + 1]);
const nativeBinary = path.resolve(root, 'dist', `sds${process.platform === 'win32' ? '.exe' : ''}`);
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
      // The global root follows the VS Code profile anchor, which is
      // ~/Library/Application Support on macOS and ~/.config elsewhere. The
      // fixture records the portable layout; the capture walks the
      // platform-specific directory on macOS.
      global: { root: '.config/Code/User/prompts', skills: '.copilot/skills', darwinRoot: 'Library/Application Support/Code/User/prompts', win32Root: 'AppData/Roaming/Code/User/prompts' },
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
  if (process.platform === 'win32') {
    // The Windows anchors read APPDATA, LOCALAPPDATA and USERPROFILE, not
    // HOME, so the capture points them at the temporary home as well.
    environment.APPDATA = path.join(homeDir, 'AppData', 'Roaming');
    environment.LOCALAPPDATA = path.join(homeDir, 'AppData', 'Local');
    environment.USERPROFILE = homeDir;
  }
  // The isolation must not depend on the developer's shell: a service or a
  // shell profile can point these at a real installation.
  for (const name of [
    'SDS_CONFIG_DIR',
    'SDS_TEMPLATE_CACHE_DIR',
    'SDS_HOME',
    'SDS_TEMPLATE_SOURCE',
    'SPEC_DRIVEN_USE_BUNDLED_TEMPLATES'
  ]) {
    delete environment[name];
  }

  if (native) {
    execFileSync(nativeBinary, [
      'inject',
      '--platform', platform,
      '--scope', scope,
      '--yes',
      '--templates', 'bundled'
    ], { cwd: workDir, env: environment, stdio: 'pipe' });
  } else {
    execFileSync('node', [
      oracle,
      'inject',
      '--platform', platform,
      '--scope', scope,
      '--yes',
      '--templates', 'bundled'
    ], { cwd: workDir, env: environment, stdio: 'pipe' });
  }

  const base = scope === 'global' ? homeDir : workDir;
  const files = [];

  // The walk follows the directory the platform actually wrote on this
  // operating system. The recorded fixture keeps the portable layout.
  const walkRoot = process.platform === 'darwin' && declaration.darwinRoot
    ? declaration.darwinRoot
    : process.platform === 'win32' && declaration.win32Root
      ? declaration.win32Root
      : declaration.root;
  const rootPath = path.join(base, walkRoot);
  const skillsRootPath = path.join(base, declaration.skills);
  const skillsRelative = path.relative(rootPath, skillsRootPath);
  const skillsInsideRoot = !skillsRelative.startsWith('..') && skillsRelative !== '';

  for (const [name, relative] of [['root', walkRoot], ['skills', declaration.skills]]) {
    const dirPath = path.join(base, relative);
    for (const file of walk(dirPath)) {
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

if (native) {
  if (!fs.existsSync(nativeBinary)) {
    console.error(`The native binary is not built: ${nativeBinary}. Run 'node scripts/build-go.mjs' first.`);
    process.exit(1);
  }
} else if (!fs.existsSync(oracle)) {
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
