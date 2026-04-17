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
  const fromHeadings = Array.from(content.matchAll(/^###\s+Requirement\s+(\d+)\s*:/gmi), (match) => `REQ-${match[1]}`);
  const explicit = content.match(/REQ-\d+/g) || [];
  return unique([...fromHeadings, ...explicit]);
}

export function extractDesignElementIds(content: string): string[] {
  const fromHeadings = Array.from(content.matchAll(/^###\s+(DES-\d+)\b/gmi), (match) => match[1]);
  const explicit = content.match(/DES-\d+/g) || [];
  return unique([...fromHeadings, ...explicit]);
}

export function extractAcceptanceCriteriaRefs(content: string): string[] {
  const refs: string[] = [];
  const explicit = content.match(/REQ-\d+\.\d+/g) || [];
  refs.push(...explicit);

  const lines = content.split('\n');
  let currentReq: string | null = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+Requirement\s+(\d+)\s*:/i);
    if (heading) {
      currentReq = heading[1];
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
