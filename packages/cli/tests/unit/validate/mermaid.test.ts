import { describe, expect, it } from 'vitest';

import { validateMermaidDiagram } from '../../../src/core/validate/shared/mermaid.js';

describe('Unit: mermaid sequence diagram validation', () => {
  it('accepts message endpoints that Mermaid declares implicitly', () => {
    const result = validateMermaidDiagram(
      'sequenceDiagram\n    participant Alice\n    client->>server: request',
      1
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a participant declaration inside a par block', () => {
    const result = validateMermaidDiagram(
      'sequenceDiagram\n    participant Alice\n    par One\n    Alice->>Bob: hi\n    end',
      1
    );

    expect(result.valid).toBe(true);
  });

  it('rejects activating a participant that is never declared or messaged', () => {
    const result = validateMermaidDiagram(
      'sequenceDiagram\n    participant Alice\n    activate Ghost',
      1
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Ghost');
    expect(result.errors[0].errorType).toBe('UndefinedParticipant');
  });

  it('accepts activating a participant that a message declared implicitly', () => {
    const result = validateMermaidDiagram(
      'sequenceDiagram\n    participant Alice\n    Alice->>Bob: hi\n    activate Bob',
      1
    );

    expect(result.valid).toBe(true);
  });
});
