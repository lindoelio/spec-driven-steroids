function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function findLineNumber(content: string, pattern: RegExp): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
}

export function extractRequirementIds(content: string): string[] {
  return extractDeclaredRequirementIds(content);
}

export function extractDeclaredRequirementIds(content: string): string[] {
  const fromHeadings = Array.from(content.matchAll(/^###\s+Requirement\s+(\d+)\s*:/gmi), (match) => `REQ-${match[1]}`);
  const explicitHeadings = Array.from(content.matchAll(/^###\s+(REQ-\d+)\b/gmi), (match) => match[1]);
  return unique([...fromHeadings, ...explicitHeadings]);
}

export function extractRequirementRefs(content: string): string[] {
  return unique(content.match(/REQ-\d+(?:\.\d+)?/g) || []);
}

export function extractDesignElementIds(content: string): string[] {
  return extractDeclaredDesignElementIds(content);
}

export function extractDeclaredDesignElementIds(content: string): string[] {
  const fromHeadings = Array.from(content.matchAll(/^###\s+(DES-\d+)\b/gmi), (match) => match[1]);
  return unique(fromHeadings);
}

export function extractDesignElementRefs(content: string): string[] {
  return unique(content.match(/DES-\d+/g) || []);
}

export function extractAcceptanceCriteriaRefs(content: string): string[] {
  const refs: string[] = [];
  const explicit = content.match(/REQ-\d+\.\d+/g) || [];
  refs.push(...explicit);

  const lines = content.split('\n');
  let currentReq: string | null = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(?:Requirement\s+(\d+)\s*:|(REQ-(\d+))\b)/i);
    if (heading) {
      currentReq = heading[1] || heading[3];
      continue;
    }

    if (!currentReq) {
      continue;
    }

    const criteria = line.match(/^\s*(\d+)(?:\.\d+)?(?:\.)?\s+/);
    if (criteria) {
      refs.push(`REQ-${currentReq}.${criteria[1]}`);
    }
  }

  return unique(refs);
}
