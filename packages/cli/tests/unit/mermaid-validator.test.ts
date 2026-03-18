import { describe, it, expect } from 'vitest';
import {
  extractMermaidBlocks,
  detectDiagramType,
  validateMermaidDiagram
} from '-dist/mermaid-validator.js';

describe('Mermaid Validator', () => {
  describe('extractMermaidBlocks', () => {
    it('extracts single Mermaid block from markdown', () => {
      const content = `# Design Document

## System Architecture

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`
`;
      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('flowchart TD');
      expect(blocks[0].startLine).toBe(5);
    });

    it('extracts multiple Mermaid blocks from markdown', () => {
      const content = `\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`

Some text

\`\`\`mermaid
sequenceDiagram
    A->>B: Hello
\`\`\`
`;
      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].content).toContain('flowchart');
      expect(blocks[1].content).toContain('sequenceDiagram');
    });

    it('handles unclosed blocks gracefully', () => {
      const content = `\`\`\`mermaid
flowchart TD
    A --> B
`;
      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(1);
    });

    it('returns empty array when no blocks found', () => {
      const content = '# No mermaid here';
      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(0);
    });
  });

  describe('detectDiagramType', () => {
    it('detects flowchart type', () => {
      const result = detectDiagramType('flowchart TD\n    A --> B');
      expect(result.type).toBe('flowchart');
      expect(result.isSupported).toBe(true);
    });

    it('detects graph type', () => {
      const result = detectDiagramType('graph LR\n    A --> B');
      expect(result.type).toBe('graph');
      expect(result.isSupported).toBe(true);
    });

    it('detects sequenceDiagram type', () => {
      const result = detectDiagramType('sequenceDiagram\n    A->>B: Hello');
      expect(result.type).toBe('sequencediagram');
      expect(result.isSupported).toBe(true);
    });

    it('detects classDiagram type', () => {
      const result = detectDiagramType('classDiagram\n    class A');
      expect(result.type).toBe('classdiagram');
      expect(result.isSupported).toBe(true);
    });

    it('detects erDiagram type', () => {
      const result = detectDiagramType('erDiagram\n    A ||--o{ B');
      expect(result.type).toBe('erdiagram');
      expect(result.isSupported).toBe(true);
    });

    it('detects unsupported diagram types', () => {
      const result = detectDiagramType('gitgraph\n    commit');
      expect(result.type).toBe('gitgraph');
      expect(result.isSupported).toBe(false);
    });

    it('returns null for empty content', () => {
      const result = detectDiagramType('');
      expect(result.type).toBeNull();
    });
  });

  describe('validateMermaidDiagram', () => {
    it('validates correct flowchart syntax', () => {
      const content = `flowchart TD
    A[Start] --> B[End]`;
      const result = validateMermaidDiagram(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.diagramType).toBe('flowchart');
    });

    it('validates correct sequenceDiagram syntax', () => {
      const content = `sequenceDiagram
    participant A
    participant B
    A->>B: Hello`;
      const result = validateMermaidDiagram(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates correct classDiagram syntax', () => {
      const content = `classDiagram
    class User {
        +String name
    }`;
      const result = validateMermaidDiagram(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates correct erDiagram syntax', () => {
      const content = `erDiagram
    User ||--o{ Order : places`;
      const result = validateMermaidDiagram(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for empty block', () => {
      const result = validateMermaidDiagram('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].errorType).toBe('EmptyBlock');
    });

    it('returns error for missing diagram type', () => {
      const result = validateMermaidDiagram('\nA --> B');
      expect(result.valid).toBe(false);
      expect(result.errors[0].errorType).toBe('MissingDiagramType');
    });

    it('returns warning but passes for unsupported diagram type', () => {
      const result = validateMermaidDiagram('gitgraph\n    commit');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('not supported');
    });
  });
});

describe('Skill Document Tests', () => {
  describe('Clarification policy in requirements-writer', () => {
    it('should contain clarification policy section', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-requirements-writer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('## Clarification Policy');
    });

    it('should define clarification triggers', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-requirements-writer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('### When to Ask');
      expect(content).toContain('### When NOT to Ask');
    });

    it('should specify max 3 questions limit', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-requirements-writer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('no more than 3');
    });

    it('should guide to proceed with assumptions when context is sufficient', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-requirements-writer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('proceed with reasonable assumptions');
    });
  });

  describe('Clarification policy in technical-designer', () => {
    it('should contain clarification policy section', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('## Clarification Policy');
    });

    it('should define ambiguity triggers for design phase', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('External integration details are missing');
      expect(content).toContain('### When to Ask');
    });
  });

  describe('Mermaid guidance in technical-designer', () => {
    it('should contain Mermaid rules section', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('## Mermaid Rules');
    });

    it('should list preferred safe diagram types', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('`flowchart`');
      expect(content).toContain('`sequenceDiagram`');
      expect(content).toContain('`classDiagram`');
      expect(content).toContain('`erDiagram`');
    });

    it('should emphasize simple valid diagrams over styling', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('Prefer simple, valid Mermaid over visually rich diagrams');
      expect(content).toContain('Avoid advanced directives');
    });

    it('should include safe Mermaid examples', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('flowchart TD');
      expect(content).toContain('sequenceDiagram');
    });

    it('should provide guidance for large diagrams', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(
        'templates/universal/skills/spec-driven-technical-designer/SKILL.md',
        'utf-8'
      );
      expect(content).toContain('Split large diagrams into multiple smaller diagrams');
    });
  });
});
