import { describe, expect, it } from 'vitest';
import { verifyBriefFile } from '../../../src/core/validate/brief.js';

const validBrief = `# Change Brief

**Lane:** brief

## Intent

Reduce repeated validation work while preserving an approval gate.

## Non-Goals

- Changing the full workflow gates.

## Acceptance Criteria

- REQ-1: The CLI validates a compact brief artifact.
- REQ-2: Every brief requirement maps to implementation work.

## Repository Evidence

- Existing: \`src/validate.ts\` - Validation entry point to extend.
- New: \`tests/brief.test.ts\` - Coverage for brief validation.

## Implementation Plan

- [ ] 1. Add brief validation
  - Change: Parse the brief structure and report deterministic errors.
  - Files: \`src/validate.ts\`, \`tests/brief.test.ts\`
  - Verify: \`pnpm test brief\`
  - _Implements: REQ-1, REQ-2_

## Final Verification

- \`pnpm typecheck\`
- \`pnpm test\`
`;

describe('Unit: brief validation', () => {
  it('accepts a valid brief', () => {
    const result = verifyBriefFile(validBrief);

    expect(result.valid).toBe(true);
    expect(result.requirementsFound).toEqual(['REQ-1', 'REQ-2']);
    expect(result.tasksFound).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['title', validBrief.replace('# Change Brief', '# Plan')],
    ['lane', validBrief.replace('**Lane:** brief', '**Lane:** full')],
    ['section', validBrief.replace('## Non-Goals', '## Exclusions')]
  ])('rejects an invalid %s', (_name, content) => {
    expect(verifyBriefFile(content).valid).toBe(false);
  });

  it('rejects non-contiguous requirement IDs', () => {
    const result = verifyBriefFile(validBrief.replace('REQ-2: Every', 'REQ-3: Every').replace('REQ-1, REQ-2_', 'REQ-1, REQ-3_'));

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('Requirement numbering is not contiguous'))).toBe(true);
  });

  it('rejects more than five requirements', () => {
    const extraRequirements = [3, 4, 5, 6]
      .map(id => `- REQ-${id}: Observable outcome ${id}.`)
      .join('\n');
    const content = validBrief
      .replace('- REQ-2: Every brief requirement maps to implementation work.', `- REQ-2: Every brief requirement maps to implementation work.\n${extraRequirements}`)
      .replace('REQ-1, REQ-2_', 'REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6_');

    const result = verifyBriefFile(content);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('1-5 requirements'))).toBe(true);
  });

  it('rejects more than eight tasks', () => {
    const tasks = Array.from({ length: 9 }, (_, index) => `- [ ] ${index + 1}. Update validation part ${index + 1}
  - Change: Implement validation part ${index + 1}.
  - Files: \`src/validate.ts\`
  - Verify: \`pnpm test\`
  - _Implements: REQ-1, REQ-2_`).join('\n\n');
    const content = validBrief.replace(/- \[ \] 1\. Add brief validation[\s\S]*?_Implements: REQ-1, REQ-2_/, tasks);

    const result = verifyBriefFile(content);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('1-8 tasks'))).toBe(true);
  });

  it.each([
    ['non-contiguous numbering', '- [ ] 1. Add brief validation', '- [ ] 2. Add brief validation'],
    ['invalid status', '- [ ] 1. Add brief validation', '- [?] 1. Add brief validation']
  ])('rejects %s', (_name, current, replacement) => {
    const result = verifyBriefFile(validBrief.replace(current, replacement));

    expect(result.valid).toBe(false);
  });

  it.each(['Change', 'Files', 'Verify'])('rejects a task without %s', field => {
    const content = validBrief.replace(new RegExp(`^  - ${field}:.*$`, 'm'), '');
    const result = verifyBriefFile(content);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes(field))).toBe(true);
  });

  it('rejects unknown and uncovered requirement references', () => {
    const result = verifyBriefFile(validBrief.replace('REQ-1, REQ-2_', 'REQ-1, REQ-9_'));

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('REQ-9 is referenced'))).toBe(true);
    expect(result.errors.some(error => error.context?.includes('REQ-2 is not covered'))).toBe(true);
  });

  it('rejects design IDs in brief traceability', () => {
    const result = verifyBriefFile(validBrief.replace('REQ-1, REQ-2_', 'REQ-1, REQ-2, DES-1_'));

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('references DES IDs'))).toBe(true);
  });

  it('rejects full-lane decimal requirement IDs', () => {
    const result = verifyBriefFile(validBrief.replace('REQ-1, REQ-2_', 'REQ-1.1, REQ-2_'));

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.context?.includes('full-lane acceptance-criterion IDs'))).toBe(true);
  });

  it('rejects unsupported top-level sections', () => {
    const content = validBrief.replace('## Final Verification', '## Notes\n\n- Extra notes.\n\n## Final Verification');

    expect(verifyBriefFile(content).valid).toBe(false);
  });

  it('rejects unresolved placeholders', () => {
    const result = verifyBriefFile(validBrief.replace('Reduce repeated validation work', '<describe intent>'));

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.errorType === 'Placeholder Error')).toBe(true);
  });

  it('rejects unresolved verification prose', () => {
    const result = verifyBriefFile(validBrief.replace('- Verify: `pnpm test brief`', '- Verify: TBD'));

    expect(result.valid).toBe(false);
  });

  it('allows legitimate angle-bracket syntax', () => {
    const content = validBrief.replace(
      'Reduce repeated validation work while preserving an approval gate.',
      'Validate Record<string, T> declarations and parse <tag> blocks without changing behavior.'
    );

    expect(verifyBriefFile(content).valid).toBe(true);
  });

  it('accepts Risks only between the implementation plan and final verification', () => {
    const withRisks = validBrief.replace('## Final Verification', '## Risks\n\n- Low risk because validation is additive.\n\n## Final Verification');
    const misplacedRisks = validBrief.replace('## Intent', '## Risks\n\n- Low risk.\n\n## Intent');

    expect(verifyBriefFile(withRisks).valid).toBe(true);
    expect(verifyBriefFile(misplacedRisks).valid).toBe(false);
  });

  it('warns about task paths without evidence without invalidating legacy briefs', () => {
    const content = validBrief.replace('- Files: `src/validate.ts`, `tests/brief.test.ts`', '- Files: `src/validate.ts`, `src/unknown.ts`');
    const result = verifyBriefFile(content);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('src/unknown.ts without an Existing or New entry');
    expect(result.warnings[0].line).toBeGreaterThan(0);
  });

  it('compares equivalent task paths without host-specific separator differences', () => {
    const content = validBrief.replace('- Files: `src/validate.ts`, `tests/brief.test.ts`', '- Files: `./src/validate.ts`, `tests\\brief.test.ts`');
    const result = verifyBriefFile(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it.each(['Looks fine', 'Tests pass', 'Check: everything', 'Check: open page =>', '` `'])('warns about weak verification: %s', verify => {
    const result = verifyBriefFile(validBrief.replace('`pnpm test brief`', verify));
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('Verification signal: task 1');
  });

  it.each(['Check: open the settings page => the saved locale is displayed', 'Check: submit an invalid form → an error is displayed', 'Check: count failures => 0'])('accepts an explicit observable verification: %s', verify => {
    const result = verifyBriefFile(validBrief.replace('`pnpm test brief`', verify));
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('accepts optional slice metadata without imposing it on existing briefs', () => {
    const result = verifyBriefFile(validBrief.replace('**Lane:** brief', '**Lane:** brief\n\n**Slice:** 2/3'));
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
