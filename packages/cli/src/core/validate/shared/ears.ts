export interface EarsCriterionValidation {
  valid: boolean;
  pattern?: string;
  errors: string[];
}

export function validateEarsCriterion(text: string): EarsCriterionValidation {
  const errors: string[] = [];
  const normalized = text.trim().replace(/\s+/g, ' ');

  if (!normalized.endsWith('.')) {
    errors.push('Acceptance criterion must be a single sentence ending with a period');
  }

  const shallMatches = normalized.match(/\bSHALL\b/g) || [];
  if (shallMatches.length !== 1) {
    errors.push('Acceptance criterion must include exactly one SHALL');
  }

  const patterns: Array<[string, RegExp]> = [
    ['ubiquitous', /^THE\s+.+\s+SHALL\s+.+\.$/],
    ['event-driven', /^WHEN\s+.+,\s+THEN\s+the\s+.+\s+SHALL\s+.+\.$/],
    ['unwanted', /^IF\s+.+,\s+THEN\s+the\s+.+\s+SHALL\s+.+\.$/],
    ['state-driven', /^WHILE\s+.+,\s+the\s+.+\s+SHALL\s+.+\.$/],
    ['optional', /^WHERE\s+.+,\s+the\s+.+\s+SHALL\s+.+\.$/],
    ['complex', /^WHILE\s+.+,\s+WHEN\s+.+,\s+THEN\s+the\s+.+\s+SHALL\s+.+\.$/],
  ];

  const matched = patterns.find(([, pattern]) => pattern.test(normalized));
  if (!matched) {
    errors.push('Acceptance criterion must match a valid EARS pattern with a named system subject');
  }

  return {
    valid: errors.length === 0,
    pattern: matched?.[0],
    errors,
  };
}
