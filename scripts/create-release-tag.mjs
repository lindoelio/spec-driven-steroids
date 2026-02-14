import fs from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.resolve('packages/cli/package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

if (!version) {
  console.error('Could not resolve version from packages/cli/package.json');
  process.exit(1);
}

const tag = `v${version}`;

process.stdout.write(tag);
