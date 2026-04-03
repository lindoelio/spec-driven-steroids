import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    expectContinuityStartup,
    expectSharedPlannerContract,
    expectTestingTrophyFallback
} from '../helpers/template-test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const standardsTemplatesRoot = path.resolve(__dirname, '../../templates');

async function readTemplate(relativePath: string): Promise<string> {
    const absolutePath = path.join(standardsTemplatesRoot, relativePath);
    return fs.readFile(absolutePath, 'utf-8');
}

async function readRepositoryFile(relativePath: string): Promise<string> {
    const absolutePath = path.resolve(__dirname, '../../../..', relativePath);
    return fs.readFile(absolutePath, 'utf-8');
}

describe('MCP Unit: template MCP guidance', () => {
    it('requires tasks and complete-spec validation in planner templates', async () => {
        // Universal template is the source of truth
        const content = await readTemplate('universal/agents/spec-driven.agent.md');
        expect(content).toContain('mcp:verify_tasks_file');
        expect(content).toContain('mcp:verify_complete_spec');
    });

    it('hardens Codex planner templates against phase-skipping', async () => {
        // Universal template is the source of truth for all platforms
        const agentContent = await readTemplate('universal/agents/spec-driven.agent.md');

        expect(agentContent).toContain('In a single user turn, you may complete at most one planning phase.');
        expect(agentContent).toContain('After finishing Phase 1, Phase 2, or Phase 3, you MUST stop');
        expect(agentContent).toContain('Do not begin design work until the user explicitly approves Phase 1.');
    });

    it('hardens all planner wrappers against phase-skipping', async () => {
        // Universal template is the source of truth
        const content = await readTemplate('universal/agents/spec-driven.agent.md');
        expectSharedPlannerContract(content);
        expect(content).toContain('After a planning artifact is written, stop immediately and wait for approval.');
    });

    it('keeps continuity startup guidance aligned across planner templates', async () => {
        // Universal template is the source of truth
        const content = await readTemplate('universal/agents/spec-driven.agent.md');
        expectContinuityStartup(content);
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
            'universal/commands/inject-guidelines.command.md'
        ];

        for (const target of targets) {
            const content = await readTemplate(target);
            expectTestingTrophyFallback(content);
        }
    });

    it('requires minimal-comments guidance in project-guidelines-writer skill', async () => {
        const content = await readTemplate('universal/skills/project-guidelines-writer/SKILL.md');
        expect(content).toContain('code comment');
        expect(content).toContain('highly necessary');
        expect(content).toContain('non-obvious intent');
    });

    it('uses trigger-rich skill descriptions with progressive-disclosure references', async () => {
        const skillTargets = [
            'universal/skills/spec-driven-requirements-writer/SKILL.md',
            'universal/skills/spec-driven-technical-designer/SKILL.md',
            'universal/skills/spec-driven-task-decomposer/SKILL.md',
            'universal/skills/spec-driven-task-implementer/SKILL.md',
            'universal/skills/project-guidelines-writer/SKILL.md'
        ];

        for (const target of skillTargets) {
            const content = await readTemplate(target);
            expect(content).toContain('Use this skill when');
            expect(content).toContain('Default path:');
        }

        const referenceTargets = [
            'universal/skills/spec-driven-requirements-writer/references/requirements-patterns.md',
            'universal/skills/spec-driven-technical-designer/references/design-section-guide.md',
            'universal/skills/spec-driven-task-decomposer/references/task-patterns.md',
            'universal/skills/spec-driven-task-implementer/references/task-execution-patterns.md'
        ];

        for (const target of referenceTargets) {
            const content = await readTemplate(target);
            expect(content.length).toBeGreaterThan(0);
        }
    });

    it('publishes templates independently from the npm package release flow', async () => {
        const content = await readRepositoryFile('.github/workflows/publish-templates.yml');

        expect(content).toContain('name: Publish Templates');
        expect(content).toContain('pnpm --filter spec-driven-steroids test');
        expect(content).toContain('templates-manifest.json');
        expect(content).toContain('templates-bundle.json');
        expect(content).toContain('ncipollo/release-action');
        expect(content).toContain('tag: templates-latest');
    });
});
