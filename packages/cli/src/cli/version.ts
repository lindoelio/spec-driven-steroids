import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../package.json');

export function getCliVersion(): string {
  try {
    const pkg = fs.readJsonSync(packageJsonPath) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function getBundledTemplatesDir(): string {
  return path.resolve(__dirname, '../../templates');
}
