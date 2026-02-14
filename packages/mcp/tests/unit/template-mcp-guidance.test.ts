import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const standardsTemplatesRoot = path.resolve(__dirname, '../../../standards/src/templates');

async function readTemplate(relativePath: string): Promise<string> {
    const absolutePath = path.join(standardsTemplatesRoot, relativePath);
    return fs.readFile(absolutePath, 'utf-8');
}

describe('MCP Unit: template MCP guidance', () => {
    it('requires tasks and complete-spec validation in planner templates', async () => {
        const targets = [
            'github/agents/spec-driven.agent.md',
            'opencode/agents/spec-driven.agent.md',
            'antigravity/workflows/spec-driven.md'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('mcp:verify_tasks_file');
            expect(content).toContain('mcp:verify_complete_spec');
        }
    });

    it('requires tasks and complete-spec validation in decomposition/implementation skills', async () => {
        const targets = [
            'universal/skills/spec-driven-task-decomposer/SKILL.md',
            'universal/skills/spec-driven-task-implementer/SKILL.md'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('mcp:verify_complete_spec');
        }

        const decomposerContent = await readTemplate('universal/skills/spec-driven-task-decomposer/SKILL.md');
        expect(decomposerContent).toContain('mcp:verify_tasks_file');
    });
});
