import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, '../../templates');

describe('Unit: Universal Agent Prompt', () => {
  it('exists at the expected path', async () => {
    const universalPath = path.join(templatesDir, 'universal/agents/spec-driven.agent.md');
    const exists = await fs.pathExists(universalPath);
    expect(exists).toBe(true);
  });

  it('contains all core behavior content', async () => {
    const universalPath = path.join(templatesDir, 'universal/agents/spec-driven.agent.md');
    const content = await fs.readFile(universalPath, 'utf-8');
    
    // Check for key sections
    expect(content).toContain('Phase Gatekeeper');
    expect(content).toContain('requirements -> design -> tasks -> implementation');
    expect(content).toContain('Non-Skippable Stop Rule');
    expect(content).toContain('Phase 1: Requirements');
    expect(content).toContain('Phase 2: Design');
    expect(content).toContain('Phase 3: Tasks');
    expect(content).toContain('Phase 4: Implementation');
    expect(content).toContain('Traceability Rules');
    expect(content).toContain('Key Behaviors');
    expect(content).toContain('Constraints');
  });

  it('uses consistent terminology "skill"', async () => {
    const universalPath = path.join(templatesDir, 'universal/agents/spec-driven.agent.md');
    const content = await fs.readFile(universalPath, 'utf-8');
    
    // Should invoke skills, not subagents
    expect(content).toContain('spec-driven-requirements-writer` skill');
    expect(content).toContain('spec-driven-technical-designer` skill');
    expect(content).toContain('spec-driven-task-decomposer` skill');
    expect(content).toContain('spec-driven-task-implementer` skill');
    
    // Should NOT contain "subagent" terminology
    expect(content).not.toContain('subagent');
  });

  it('uses consistent CLI invocation syntax', async () => {
    const universalPath = path.join(templatesDir, 'universal/agents/spec-driven.agent.md');
    const content = await fs.readFile(universalPath, 'utf-8');

    // Should use CLI commands for validation
    expect(content).toContain('spec-driven validate requirements');
    expect(content).toContain('spec-driven validate design');
    expect(content).toContain('spec-driven validate tasks');
    expect(content).toContain('spec-driven validate spec');
  });
});