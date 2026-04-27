import { extractDeclaredDesignElementIds } from './ids.js';

export function stripInlineMarkdown(value: string): string {
  return value.replace(/[*_`]/g, '');
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
