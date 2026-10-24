import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

import { expectThinEntryPoint, readPlannerContract } from '../helpers/template-test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, '../../templates');

const agentPath = path.join(templatesDir, 'universal/agents/spec-driven.agent.md');

describe('Unit: Universal Agent Prompt', () => {
  it('exists at the expected path', async () => {
    expect(await fs.pathExists(agentPath)).toBe(true);
  });

  it('keeps the agent entry point thin and pointing at the planner skill', async () => {
    const content = await fs.readFile(agentPath, 'utf-8');

    expectThinEntryPoint(content);
    expect(content).toContain('Never implement before the selected lane\'s approval gate');
  });

  it('keeps the normative planner contract in the planner skill', async () => {
    const content = await readPlannerContract();

    expect(content).toContain('## Lifecycle');
    expect(content).toContain('## Lane Selection');
    expect(content).toContain('### Brief Lane');
    expect(content).toContain('### Full Lane');
    expect(content).toContain('### No Direct Lane');
    expect(content).toContain('spec-driven-brief-planner` skill');
    expect(content.indexOf('If brief and full artifacts are mixed')).toBeLessThan(
      content.indexOf('Honor an explicit `lane:brief`')
    );
    expect(content).toContain('Otherwise choose brief');
    expect(content).toContain('requirements -> design -> tasks -> Red Team Review -> implementation -> Code Review');
    expect(content).toContain('Non-Skippable Stop Rule');
    expect(content).toContain('Phase 1: Requirements');
    expect(content).toContain('Phase 2: Design');
    expect(content).toContain('Phase 3: Tasks');
    expect(content).toContain('Phase 4: Implementation');
    expect(content).toContain('Traceability Rules');
    expect(content).toContain('Key Behaviors');
    expect(content).toContain('Constraints');
  });

  it('uses consistent terminology "skill" in the planner contract', async () => {
    const content = await readPlannerContract();

    // Should invoke skills, not sub-agents directly (sub-agent terms are for platform delegation)
    expect(content).toContain('spec-driven-requirements-writer` skill');
    expect(content).toContain('spec-driven-technical-designer` skill');
    expect(content).toContain('spec-driven-task-decomposer` skill');
    expect(content).toContain('spec-driven-task-implementer` skill');

    // SDS uses "sub-agent" (hyphenated) and "subagent_type" (platform tool parameter)
    // intentionally for delegation. The primary orchestration is done through skills.
    expect(content).toContain('sub-agent');
    expect(content).toContain('Sub-agent delegation protocol');
  });

  it('delegates CLI validation to shared protocol via Unified Quality Gate', async () => {
    const content = await readPlannerContract();

    // Planner contract references Unified Quality Gate and shared protocol
    expect(content).toContain('Unified Quality Gate');
    expect(content).toContain('shared protocol');

    // Shared protocol contains the actual CLI commands
    const sharedProtocolPath = path.join(templatesDir, 'universal/skills/spec-driven-shared-protocol/references/shared-protocol.md');
    const sharedContent = await fs.readFile(sharedProtocolPath, 'utf-8');
    expect(sharedContent).toContain('sds validate requirements');
    expect(sharedContent).toContain('sds validate design');
    expect(sharedContent).toContain('sds validate tasks');
    expect(sharedContent).toContain('sds validate spec');
  });
});
