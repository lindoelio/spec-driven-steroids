import { describe, expect, it } from 'vitest';
import { validateEarsCriterion } from '../../../src/core/validate/shared/ears.js';
import { verifyRequirementsFile } from '../../../src/core/validate/requirements.js';

describe('Unit: EARS criterion validation', () => {
  it.each([
    'THE application SHALL display the dashboard.',
    'WHEN the user submits the form, THEN the application SHALL validate the input.',
    'IF the payment fails, THEN the application SHALL display a failure message.',
    'WHILE the session is expired, the application SHALL require authentication.',
    'WHERE audit logging is enabled, the application SHALL record the action.',
    'WHILE the user is authenticated, WHEN the user opens settings, THEN the application SHALL display account controls.'
  ])('accepts valid EARS syntax: %s', (criterion) => {
    expect(validateEarsCriterion(criterion).valid).toBe(true);
  });

  it('rejects random SHALL text without a valid pattern', () => {
    expect(validateEarsCriterion('This SHALL not be accepted.').valid).toBe(false);
  });

  it('rejects weak should phrasing', () => {
    expect(validateEarsCriterion('The system should display the dashboard.').valid).toBe(false);
  });

  it('rejects criteria with multiple SHALL keywords', () => {
    expect(validateEarsCriterion('THE application SHALL validate input and SHALL store output.').valid).toBe(false);
  });

  it('requires every requirement to have valid acceptance criteria', () => {
    const content = `# Requirements

## Requirements

### REQ-1: Login

**User Story:** As a user, I want login, so that I can access my account.

#### Acceptance Criteria
1.1 The system should login.
`;

    const result = verifyRequirementsFile(content);

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.errorType === 'EARS Error')).toBe(true);
  });
});
