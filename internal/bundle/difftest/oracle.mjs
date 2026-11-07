// The oracle driver of the differential harness.
//
// It runs the shared cases against the previous release, so the harness can
// diff the answers of the previous release with the answers of the port.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../../../packages/cli/dist/cli');

const contract = await import(pathToFileURL(path.join(distDir, 'template-bundle.js')).href);
const source = await import(pathToFileURL(path.join(distDir, 'template-source.js')).href);

const casesPath = process.argv[2] ?? path.join(here, 'cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8')).cases;

// The source selection of the environment must not leak into a case.
delete process.env.SDS_TEMPLATE_SOURCE;

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function bundleDocument(spec) {
  if (!spec) return '';

  let files = [];
  if (typeof spec.fileCount === 'number') {
    for (let index = 0; index < spec.fileCount; index += 1) {
      files.push({ path: `universal/file-${index}.md`, content: 'x' });
    }
  } else if (typeof spec.oversizeBytes === 'number') {
    files.push({ path: 'universal/large.md', content: 'a'.repeat(spec.oversizeBytes) });
  } else {
    files = spec.files ?? [];
  }

  const schemaVersion = typeof spec.schemaVersion === 'number' ? spec.schemaVersion : 1;
  const contents = {};
  for (const file of files) contents[file.path] = file.content;
  return JSON.stringify({ schemaVersion, version: spec.version, files: contents });
}

function manifestDocument(spec, digest) {
  if (!spec) return '';

  const document = {};
  if (typeof spec.schemaVersion === 'number') document.schemaVersion = spec.schemaVersion;
  document.version = spec.version;
  document.bundleUrl = spec.bundleUrl;
  if (typeof spec.sha256 === 'string' && spec.sha256.length > 0) {
    document.sha256 = spec.sha256 === '{{digest}}' ? digest : spec.sha256;
  }
  if (typeof spec.minCliVersion === 'string' && spec.minCliVersion.length > 0) {
    document.minCliVersion = spec.minCliVersion;
  }
  if (typeof spec.publishedAt === 'string' && spec.publishedAt.length > 0) {
    document.publishedAt = spec.publishedAt;
  }
  return JSON.stringify(document);
}

function errorResult(error, label) {
  return {
    ok: false,
    kind: error.kind ?? 'invalid',
    message: error.message ?? String(error)
  };
}

function runManifest(testCase) {
  let data;
  try {
    data = JSON.parse(testCase.payload);
  } catch (error) {
    return { ok: false, kind: 'invalid', message: `Template manifest is not valid JSON: ${error.message}` };
  }
  try {
    const manifest = contract.parseTemplateManifest(data);
    return {
      ok: true,
      manifest: {
        version: manifest.version,
        bundleUrl: manifest.bundleUrl,
        sha256: manifest.sha256 ?? null,
        minCliVersion: manifest.minCliVersion ?? null,
        publishedAt: manifest.publishedAt ?? null,
        schemaVersion: manifest.schemaVersion ?? null,
        schemaVersionSet: manifest.schemaVersion !== undefined
      }
    };
  } catch (error) {
    return errorResult(error);
  }
}

function runBundle(testCase) {
  const payload = testCase.payload ?? bundleDocument(testCase.bundleSpec);
  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    return { ok: false, kind: 'invalid', message: `Template bundle is not valid JSON: ${error.message}` };
  }
  try {
    const parsed = contract.parseTemplateBundle(data);
    return {
      ok: true,
      version: parsed.bundle.version,
      schemaVersion: parsed.bundle.schemaVersion ?? null,
      schemaVersionSet: parsed.bundle.schemaVersion !== undefined,
      fileCount: Object.keys(parsed.bundle.files).length,
      byteSize: parsed.byteSize,
      entries: parsed.entries.slice(0, 5).map(([path, contents]) => ({ path, contents }))
    };
  } catch (error) {
    return errorResult(error);
  }
}

function runPath(testCase) {
  try {
    return { ok: true, normalized: contract.normalizeRelativeTemplatePath(testCase.path) };
  } catch (error) {
    return errorResult(error);
  }
}

function runInside(testCase) {
  try {
    return { ok: true, resolved: contract.resolveInside(testCase.root, testCase.relative) };
  } catch (error) {
    return errorResult(error);
  }
}

function responseFor(text) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-length': String(Buffer.byteLength(text)) }),
    text: async () => text,
    json: async () => JSON.parse(text)
  };
}

function responseWithStatus(text, status) {
  return {
    ok: false,
    status,
    statusText: status === 404 ? 'Not Found' : 'Error',
    headers: new Headers({ 'content-length': String(Buffer.byteLength(text)) }),
    text: async () => text,
    json: async () => JSON.parse(text)
  };
}

function listFiles(root) {
  const files = [];
  if (!root || !fs.existsSync(root)) return files;

  const walk = (directory, prefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) files.push(relative);
    }
  };
  walk(root, '');
  return files.sort();
}

function touchVersionDir(rootDir, index) {
  if (!rootDir) return;
  const stamp = new Date((1700000000 + index * 60) * 1000);
  try {
    fs.utimesSync(path.dirname(rootDir), stamp, stamp);
  } catch {
    // The cache is a fixture; an unwritable directory does not change the answer.
  }
}

function listCacheVersions(cacheDir) {
  if (!fs.existsSync(cacheDir)) return [];
  return fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function readMarker(rootDir) {
  if (!rootDir) return null;
  const markerPath = path.join(path.dirname(rootDir), '.sds-template-bundle.json');
  if (!fs.existsSync(markerPath)) return null;
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  const files = {};
  for (const key of Object.keys(marker.files ?? {}).sort()) files[key] = marker.files[key];
  const raw = fs.readFileSync(markerPath, 'utf8').replace(/"extractedAt":\s*"[^"]*"/g, '"extractedAt": "TIMESTAMP"');
  return { sha256: marker.sha256, version: marker.version, files, raw };
}

async function runBundled() {
  const cli = path.resolve(here, '../../../packages/cli/dist/cli/index.js');
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'templates', 'info', '--json'], {
      env: { ...process.env, SDS_TEMPLATE_SOURCE: 'bundled' }
    });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve(stdout) : reject(new Error(`cli exited with ${code}`))));
  });
  const payload = JSON.parse(output);
  return {
    source: payload.source,
    version: payload.version,
    fallbackReason: payload.fallbackReason ?? null,
    warnings: payload.warnings
  };
}

function resolveDocuments(testCase, version) {
  let bundleText = testCase.payload;
  if (!bundleText) {
    const spec = testCase.bundle ?? testCase.bundleSpec;
    const copied = spec ? { ...spec } : null;
    if (copied && version) copied.version = version;
    bundleText = copied ? bundleDocument(copied) : '';
  }

  const digest = sha256(bundleText);
  const manifest = testCase.manifest ? { ...testCase.manifest } : null;
  if (manifest && version) manifest.version = version;
  return [bundleText, manifest ? manifestDocument(manifest, digest) : ''];
}

async function runResolve(testCase) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-difftest-'));
  const bundledTemplatesDir = path.join(root, 'bundled');
  fs.mkdirSync(bundledTemplatesDir, { recursive: true });
  const cacheDir = path.join(root, 'cache');

  let bundleText = '';
  let manifestText = '';

  const fetchImpl = async input => {
    const url = String(input);
    if (testCase.fetchError) throw new Error(testCase.fetchError);
    const status = testCase.status ?? 200;
    if (url.endsWith('/templates-bundle.json')) {
      const body = testCase.bundlePayloadBytes
        ? 'x'.repeat(testCase.bundlePayloadBytes)
        : (testCase.bundlePayload ?? bundleText);
      return status === 200 ? responseFor(body) : responseWithStatus(body, status);
    }
    const manifest = testCase.manifestPayload ?? manifestText;
    return status === 200 ? responseFor(manifest) : responseWithStatus(manifest, status);
  };

  const records = [];
  let rootDir = null;

  for (const step of testCase.steps ?? []) {
    switch (step.action) {
      case 'resolve': {
        [bundleText, manifestText] = resolveDocuments(testCase, step.version ?? '');
        const options = {
          bundledTemplatesDir,
          cacheDir,
          manifestUrl: testCase.manifestUrl ?? 'https://example.test/templates-manifest.json',
          cliVersion: testCase.cliVersion ?? '1.0.0',
          fetchImpl
        };
        if (!testCase.useDefaultSource) options.source = 'remote';
        if (step.requiredSkills) options.requiredSkills = step.requiredSkills;

        const resolution = await source.resolveTemplateSource(options);
        rootDir = resolution.rootDir;
        touchVersionDir(rootDir, records.length);
        records.push({
          action: 'resolve',
          source: resolution.source,
          version: resolution.version,
          sha256: resolution.sha256 ?? null,
          fallbackReason: resolution.fallbackReason ?? null,
          errorKind: resolution.errorKind ?? null,
          warnings: resolution.warnings
        });
        break;
      }
      case 'removeFile':
        if (rootDir) fs.rmSync(path.join(rootDir, step.path), { force: true });
        records.push({ action: 'removeFile', ok: true });
        break;
      case 'writeFile':
        if (rootDir) {
          const target = path.join(rootDir, step.path);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, step.content);
        }
        records.push({ action: 'writeFile', ok: true });
        break;
      case 'createFile': {
        const target = path.join(root, step.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, step.content);
        records.push({ action: 'createFile', ok: true });
        break;
      }
      case 'listFiles':
        records.push({ action: 'listFiles', files: listFiles(rootDir) });
        break;
      case 'marker':
        records.push({ action: 'marker', marker: readMarker(rootDir) });
        break;
      case 'listCache':
        records.push({ action: 'listCache', versions: listCacheVersions(cacheDir) });
        break;
      case 'exists':
        records.push({ action: 'exists', exists: fs.existsSync(path.join(root, step.path)) });
        break;
      default:
        throw new Error(`Unknown step ${step.action}`);
    }
  }

  return { records };
}

async function runCase(testCase) {
  const previous = {};
  for (const [name, value] of Object.entries(testCase.env ?? {})) {
    previous[name] = process.env[name];
    process.env[name] = value;
  }

  try {
    switch (testCase.kind) {
      case 'manifest':
        return runManifest(testCase);
      case 'bundle':
        return runBundle(testCase);
      case 'semver':
        return { result: contract.compareSemver(testCase.left, testCase.right) };
      case 'host':
        return { allowed: contract.isAllowedBundleHost(testCase.hostname, testCase.manifestHost) };
      case 'path':
        return runPath(testCase);
      case 'inside':
        return runInside(testCase);
      case 'resolve':
        return await runResolve(testCase);
      case 'bundled':
        return await runBundled();
      default:
        throw new Error(`Unknown case kind ${testCase.kind}`);
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

for (const testCase of cases) {
  const result = await runCase(testCase);
  process.stdout.write(`${JSON.stringify({ case: testCase.name, kind: testCase.kind, result })}\n`);
}
