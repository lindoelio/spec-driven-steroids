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
  expect(content).toContain('## Lifecycle');
  expect(content).toContain('requirements -> design -> tasks -> Red Team Review -> implementation -> Code Review');
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

export function expectIncrementalGuidelinesContract(content: string): void {
  expect(content).toContain('Review all six guideline documents by default unless the user explicitly skips named files.');
  expect(content).toContain('Preserve valid content, structure, wording, and formatting.');
  expect(content).toContain('Use targeted patches for existing files; never regenerate them by default.');
  expect(content).toContain('If no justified changes remain, do not write the file.');
  expect(content).toContain('Do not add generator branding, ownership markers, or tool-specific maintenance instructions.');
  expect(content).toContain('Remove only legacy SpecDriven:managed delimiter comments; preserve all enclosed content.');
  expect(content).toContain('Replace obsolete generator-only maintenance instructions with ordinary editing guidance; preserve tools and workflows that belong to the project itself.');
  expect(content).not.toMatch(/<!--\s*SpecDriven:managed(?::(?:start|end))?\s*-->/);
  expect(content).not.toContain('update managed sections only');
  expect(content).not.toContain('prefer managed-section updates');
}

export function expectRemoteTemplateFallbackMessage(content: string): void {
  expect(content).toMatch(/bundled templates/i);
  expect(content).toMatch(/fallback/i);
}
