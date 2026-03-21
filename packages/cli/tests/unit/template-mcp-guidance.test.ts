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
            'antigravity/workflows/spec-driven.md',
            'codex/agents/spec-driven.toml'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('mcp:verify_tasks_file');
            expect(content).toContain('mcp:verify_complete_spec');
        }
    });

    it('hardens Codex planner templates against phase-skipping', async () => {
        const agentContent = await readTemplate('codex/agents/spec-driven.toml');
        const commandContent = await readTemplate('codex/commands/spec-driven.md');

        expect(agentContent).toContain('In a single user turn, you may complete at most one planning phase.');
        expect(agentContent).toContain('After finishing Phase 1, Phase 2, or Phase 3, you MUST stop');
        expect(agentContent).toContain('Stop. Do not begin design work until the user explicitly approves Phase 1.');

        expect(commandContent).toContain('After Phase 1 is written, stop immediately.');
        expect(commandContent).toContain('Do not start Phase 2, Phase 3, or Phase 4 in the same turn.');
    });

    it('hardens all planner wrappers against phase-skipping', async () => {
        const targets = [
            'github/agents/spec-driven.agent.md',
            'opencode/agents/spec-driven.agent.md',
            'antigravity/workflows/spec-driven.md',
            'codex/agents/spec-driven.toml'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('### Non-Skippable Stop Rule');
            expect(content).toContain('In a single user turn, you may complete at most one planning phase.');
            expect(content).toContain('After a planning artifact is written, stop immediately and wait for approval.');
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

        expect(decomposerContent).toContain('Prefix test tasks with `Test:`');
        expect(decomposerContent).toContain('do not include `REQ-*` IDs in the title');
        expect(decomposerContent).not.toContain('Test REQ-');

        expect(implementerContent).toContain('Do not include `REQ-*` or `DES-*` IDs in test names');
        expect(implementerContent).toContain('Do not include `REQ-*` or `DES-*` IDs in code comments');
        expect(implementerContent).not.toContain('tasks prefixed with "Test REQ-"');
    });

    it('requires Testing Trophy fallback guidance for inject-guidelines templates', async () => {
        const targets = [
            'universal/skills/project-guidelines-writer/SKILL.md',
            'github/prompts/inject-guidelines.prompt.md',
            'opencode/commands/inject-guidelines.md',
            'antigravity/workflows/inject-guidelines.md',
            'codex/commands/inject-guidelines.md'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expect(content).toContain('Testing Trophy');
            expect(content).toMatch(/integration/i);
            expect(content).toMatch(/e2e/i);
            expect(content).toMatch(/unit tests?/i);
        }
    });

    it('requires minimal-comments guidance in project-guidelines-writer skill', async () => {
        const content = await readTemplate('universal/skills/project-guidelines-writer/SKILL.md');
        expect(content).toContain('code comment');
        expect(content).toContain('highly necessary');
        expect(content).toContain('non-obvious intent');
    });
});
