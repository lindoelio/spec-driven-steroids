export interface MermaidError {
  line: number;
  errorType: string;
  message: string;
  suggestedFix: string;
}

export interface MermaidWarning {
  line: number;
  message: string;
}

export interface MermaidValidationResult {
  valid: boolean;
  errors: MermaidError[];
  warnings: MermaidWarning[];
  diagramType: string | null;
}

export interface MermaidBlock {
  content: string;
  startLine: number;
  endLine: number;
}

const SUPPORTED_DIAGRAM_TYPES = [
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'erdiagram'
] as const;

type SupportedDiagramType = typeof SUPPORTED_DIAGRAM_TYPES[number];

export function extractMermaidBlocks(content: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const lines = content.split('\n');
  
  let inMermaidBlock = false;
  let blockStart = -1;
  let blockLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim() === '```mermaid') {
      inMermaidBlock = true;
      blockStart = i + 1;
      blockLines = [];
      continue;
    }
    
    if (inMermaidBlock && line.trim() === '```') {
      blocks.push({
        content: blockLines.join('\n'),
        startLine: blockStart,
        endLine: i + 1
      });
      inMermaidBlock = false;
      blockStart = -1;
      blockLines = [];
      continue;
    }
    
    if (inMermaidBlock) {
      blockLines.push(line);
    }
  }
  
  if (inMermaidBlock && blockStart > 0) {
    blocks.push({
      content: blockLines.join('\n'),
      startLine: blockStart,
      endLine: lines.length
    });
  }
  
  return blocks;
}

function detectDiagramType(content: string): { type: string | null; isSupported: boolean } {
  const firstLine = content.split('\n')[0]?.trim().toLowerCase() || '';
  
  for (const supportedType of SUPPORTED_DIAGRAM_TYPES) {
    if (firstLine.startsWith(supportedType)) {
      return { type: supportedType, isSupported: true };
    }
  }
  
  const knownUnsupportedTypes = [
    'gitgraph', 'mindmap', 'timeline', 'quadrantchart', 'requirementdiagram',
    'gantt', 'pie', 'state', 'journey', 'c4context', 'c4container', 'c4component'
  ];
  
  for (const unsupportedType of knownUnsupportedTypes) {
    if (firstLine.startsWith(unsupportedType)) {
      return { type: unsupportedType, isSupported: false };
    }
  }
  
  const possibleType = firstLine.split(/\s+/)[0] || null;
  return { type: possibleType, isSupported: false };
}

export function validateMermaidDiagram(content: string, blockStartLine: number = 1): MermaidValidationResult {
  const errors: MermaidError[] = [];
  const warnings: MermaidWarning[] = [];
  
  if (!content.trim()) {
    return {
      valid: false,
      errors: [{
        line: blockStartLine,
        errorType: 'EmptyBlock',
        message: 'Mermaid code block is empty',
        suggestedFix: 'Add Mermaid diagram content or remove the empty block'
      }],
      warnings: [],
      diagramType: null
    };
  }
  
  const { type, isSupported } = detectDiagramType(content);
  
  if (!type) {
    errors.push({
      line: blockStartLine,
      errorType: 'MissingDiagramType',
      message: 'No diagram type specified on first line',
      suggestedFix: 'Add a diagram type: flowchart, sequenceDiagram, classDiagram, or erDiagram'
    });
    return { valid: false, errors, warnings, diagramType: null };
  }
  
  if (!isSupported) {
    warnings.push({
      line: blockStartLine,
      message: `Diagram type '${type}' is not supported for validation. Supported types: ${SUPPORTED_DIAGRAM_TYPES.join(', ')}`
    });
    return { valid: true, errors: [], warnings, diagramType: type };
  }
  
  const lines = content.split('\n');
  const diagramType = type as SupportedDiagramType;
  
  switch (diagramType) {
    case 'sequencediagram':
      validateSequenceDiagram(lines, blockStartLine, errors);
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    diagramType: type
  };
}

function validateSequenceDiagram(lines: string[], startLine: number, errors: MermaidError[]): void {
  const participants = new Set<string>();
  const participantPattern = /^(?:participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)/i;
  const messagePattern = /^([A-Za-z][A-Za-z0-9_]*)\s*-?-?>>?\s*([A-Za-z][A-Za-z0-9_]*)/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = startLine + i;
    const trimmed = line.trim();
    
    if (i === 0) continue;
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('note ') || trimmed.startsWith('rect ') || trimmed === 'end') {
      continue;
    }
    
    if (trimmed.startsWith('autonumber')) continue;
    
    if (/^(?:loop|alt|else|opt|par|and|critical|option|break)/i.test(trimmed)) {
      continue;
    }
    
    const participantMatch = trimmed.match(participantPattern);
    if (participantMatch) {
      participants.add(participantMatch[1]);
      continue;
    }
    
    const activateMatch = trimmed.match(/^(?:activate|deactivate)\s+([A-Za-z][A-Za-z0-9_]*)/i);
    if (activateMatch) {
      if (participants.size > 0 && !participants.has(activateMatch[1])) {
        errors.push({
          line: lineNum,
          errorType: 'UndefinedParticipant',
          message: `Participant '${activateMatch[1]}' is not defined`,
          suggestedFix: `Add 'participant ${activateMatch[1]}' before this line`
        });
      }
      continue;
    }
    
    const messageMatch = trimmed.match(messagePattern);
    if (messageMatch) {
      const [, from, to] = messageMatch;
      if (participants.size > 0) {
        if (!participants.has(from) && !from.match(/^[A-Z]/)) {
          continue;
        }
        if (!participants.has(to) && !to.match(/^[A-Z]/)) {
          continue;
        }
      }
    }
  }
}
