import { extractDeclaredDesignElementIds } from './ids.js';

export function stripInlineMarkdown(value: string): string {
  return value.replace(/[*_`]/g, '');
}

export function extractImplementsRefs(content: string): string[] {
  const matches = content.match(/_Implements:\s*([^_\n]+)/gi) || [];
  const refs: string[] = [];
  for (const match of matches) {
    const ids = match.match(/REQ-\d+(?:\.\d+)?|DES-\d+/g) || [];
    refs.push(...ids);
  }
  return refs;
}

export interface TraceabilityLink {
  from: string;
  to: string;
}

export function extractTraceabilityLinks(content: string): TraceabilityLink[] {
  const links: TraceabilityLink[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const implementsMatch = line.match(/_Implements:\s*([^_\n]+)_/i);
    if (!implementsMatch) continue;
    
    const refs = implementsMatch[1].match(/REQ-\d+(?:\.\d+)?|DES-\d+/g) || [];
    for (const ref of refs) {
      links.push({ from: ref, to: ref });
    }
  }
  
  return links;
}

export interface TraceabilityReport {
  linked: string[];
  orphaned: string[];
  invalidReqRefs: string[];
}

export function buildTraceabilityReport(
  content: string,
  validReqRefs: string[] = []
): TraceabilityReport {
  const linked: string[] = [];
  const orphaned: string[] = [];
  const invalidReqRefs: string[] = [];
  
  const desIds = extractDeclaredDesignElementIds(content);
  const lines = content.split('\n');
  
  for (const desId of desIds) {
    const start = lines.findIndex((line) => new RegExp(`^###\\s+${desId}\\b`).test(line));
    const endLineIdx = lines.findIndex((line, idx) => idx > start && /^###\s+DES-\d+\b/.test(line));
    const end = endLineIdx === -1 ? lines.length : endLineIdx;
    
    const section = lines.slice(start, end).join('\n');
    const implementsLine = section.match(/_Implements:[^\n]+/i)?.[0] || '';
    const reqRefs = implementsLine.match(/REQ-\d+(?:\.\d+)?/g) || [];
    
    if (reqRefs.length === 0) {
      orphaned.push(desId);
      continue;
    }
    
    for (const reqRef of reqRefs) {
      linked.push(`${desId} -> ${reqRef}`);
      if (validReqRefs.length > 0 && !validReqRefs.includes(reqRef)) {
        invalidReqRefs.push(`${desId} -> ${reqRef}`);
      }
    }
  }
  
  return { linked, orphaned, invalidReqRefs };
}
