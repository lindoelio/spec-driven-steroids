import fs from 'node:fs';
import path from 'node:path';

const rootPackageJsonPath = path.resolve('package.json');
const cliPackageJsonPath = path.resolve('packages/cli/package.json');

const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const cliPackageJson = JSON.parse(fs.readFileSync(cliPackageJsonPath, 'utf8'));

if (!cliPackageJson.version) {
  console.error('Could not resolve version from packages/cli/package.json');
  process.exit(1);
}

rootPackageJson.version = cliPackageJson.version;
fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(rootPackageJson, null, 4)}\n`);

console.log(`Synced root package.json version to ${cliPackageJson.version}`);
