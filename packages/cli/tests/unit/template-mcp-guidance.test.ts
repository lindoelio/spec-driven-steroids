import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const standardsTemplatesRoot = path.resolve(__dirname, '../../templates');

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

    it('requires behavior-focused testing task names with REQ IDs only in traceability tags', async () => {
        const decomposerContent = await readTemplate('universal/skills/spec-driven-task-decomposer/SKILL.md');
        const implementerContent = await readTemplate('universal/skills/spec-driven-task-implementer/SKILL.md');

        expect(decomposerContent).toContain('prefixed with `Test:`');
        expect(decomposerContent).toContain('Do not include `REQ-X.Y` IDs in task titles');
        expect(decomposerContent).not.toContain('Test REQ-');

        expect(implementerContent).toContain('Never include IDs in test titles');
        expect(implementerContent).toContain('Never include IDs in code comments');
        expect(implementerContent).not.toContain('tasks prefixed with "Test REQ-"');
    });

    it('requires Testing Trophy fallback guidance for inject-guidelines templates', async () => {
        const targets = [
            'universal/skills/project-guidelines-writer/SKILL.md',
            'github/prompts/inject-guidelines.prompt.md',
            'opencode/commands/inject-guidelines.md',
            'antigravity/workflows/inject-guidelines.md'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('Testing Trophy');
            expect(content).toMatch(/integration/i);
            expect(content).toMatch(/e2e/i);
            expect(content).toMatch(/unit tests?/i);
            expect(content).toMatch(/secondary/i);
        }
    });
});
