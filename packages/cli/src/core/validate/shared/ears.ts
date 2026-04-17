const EARS_KEYWORDS = ['WHEN', 'IF', 'THEN', 'SHALL', 'WHILE', 'WHERE'] as const;

export function detectEarsPatterns(content: string): string[] {
  const found: string[] = [];
  for (const keyword of EARS_KEYWORDS) {
    if (content.includes(keyword)) {
      found.push(keyword);
    }
  }
  return found;
}

export function hasEarsPatterns(content: string): boolean {
  return detectEarsPatterns(content).length > 0;
}
