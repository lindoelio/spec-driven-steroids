import fs from 'node:fs';
import path from 'node:path';

const versionPath = path.resolve('VERSION');
const version = fs.readFileSync(versionPath, 'utf8').trim();

if (!version) {
  console.error('Could not resolve the declared version from VERSION');
  process.exit(1);
}

process.stdout.write(`v${version}`);
