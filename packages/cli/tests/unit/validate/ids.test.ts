import { describe, expect, it } from 'vitest';
import {
  extractDeclaredDesignElementIds,
  extractDeclaredRequirementIds,
  extractDesignElementRefs,
  extractRequirementRefs
} from '../../../src/core/validate/shared/ids.js';

describe('Unit: declared ID extraction', () => {
  it('does not treat requirement references in prose as declarations', () => {
    const content = 'This mentions REQ-1 but does not declare it.';

    expect(extractDeclaredRequirementIds(content)).toEqual([]);
    expect(extractRequirementRefs(content)).toEqual(['REQ-1']);
  });

  it('extracts requirement declarations from headings', () => {
    const content = '### REQ-1: Login\n### Requirement 2: Logout';

    expect(extractDeclaredRequirementIds(content)).toEqual(['REQ-2', 'REQ-1']);
  });

  it('does not treat design references in traceability tags as declarations', () => {
    const content = '_Implements: DES-1_';

    expect(extractDeclaredDesignElementIds(content)).toEqual([]);
    expect(extractDesignElementRefs(content)).toEqual(['DES-1']);
  });

  it('extracts design declarations from headings', () => {
    const content = '### DES-1: Service Boundary\n_Implements: REQ-1.1_';

    expect(extractDeclaredDesignElementIds(content)).toEqual(['DES-1']);
  });
});
