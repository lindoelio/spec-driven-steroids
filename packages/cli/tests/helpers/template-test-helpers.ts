import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const templatesRoot = path.resolve(__dirname, '../../templates');

export async function readTemplate(relativePath: string): Promise<string> {
  return fs.readFile(path.join(templatesRoot, relativePath), 'utf-8');
}

export function expectSharedPlannerContract(content: string): void {
  expect(content).toContain('## Phase Gatekeeper');
  expect(content).toContain('requirements -> design -> tasks -> implementation');
  expect(content).toContain('### Non-Skippable Stop Rule');
}

export function expectContinuityStartup(content: string): void {
  expect(content).toContain('long-running-work-planning');
  expect(content).toMatch(/start of (each|the) (planning )?phase/i);
}

export function expectTestingTrophyFallback(content: string): void {
  expect(content).toContain('Testing Trophy');
  expect(content).toMatch(/integration/i);
  expect(content).toMatch(/e2e/i);
  expect(content).toMatch(/unit tests?/i);
}

export function expectRemoteTemplateFallbackMessage(content: string): void {
  expect(content).toMatch(/bundled templates/i);
  expect(content).toMatch(/fallback/i);
}
