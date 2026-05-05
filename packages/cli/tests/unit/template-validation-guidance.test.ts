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

describe('Unit: template validation guidance', () => {
    it('requires tasks and complete-spec validation in planner templates', async () => {
        // Universal template is the source of truth
        const content = await readTemplate('universal/agents/spec-driven.agent.md');
        expect(content).toContain('sds validate tasks');
        expect(content).toContain('sds validate spec');
        expect(content).toContain('Never claim validation passed unless the command was actually run against the written file');
    });

    it('uses write-before-validate sequencing for planning artifacts', async () => {
        const content = await readTemplate('universal/agents/spec-driven.agent.md');

        expect(content).toContain('Write `.specs/changes/<slug>/requirements.md`.');
        expect(content).toContain('Validate with `sds validate requirements .specs/changes/<slug>/requirements.md`.');
        expect(content.indexOf('Write `.specs/changes/<slug>/requirements.md`.')).toBeLessThan(
            content.indexOf('Validate with `sds validate requirements .specs/changes/<slug>/requirements.md`.')
        );
        expect(content).not.toContain('Invoke the `quality-grading` skill in `grade-and-fix` mode');
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
        // Phase skills now reference shared protocol for validation commands
        const decomposerContent = await readTemplate('universal/skills/spec-driven-task-decomposer/SKILL.md');
        const implementerContent = await readTemplate('universal/skills/spec-driven-task-implementer/SKILL.md');
        const sharedProtocolContent = await readTemplate('universal/skills/shared/references/shared-protocol.md');

        // Phase skills should reference shared protocol
        expect(decomposerContent).toContain('spec-driven-shared');
        expect(implementerContent).toContain('spec-driven-shared');

        // Shared protocol should contain validation commands
        expect(sharedProtocolContent).toContain('sds validate spec');
        expect(sharedProtocolContent).toContain('sds validate tasks');
    });

    it('requires behavior-focused testing task names with REQ IDs only in traceability tags', async () => {
        const decomposerContent = await readTemplate('universal/skills/spec-driven-task-decomposer/SKILL.md');
        const implementerContent = await readTemplate('universal/skills/spec-driven-task-implementer/SKILL.md');

        expect(decomposerContent).toContain('Prefix test tasks with `Test:`');
        expect(decomposerContent).toContain('do not include `REQ-*` IDs in the title');
        expect(decomposerContent).not.toContain('Test REQ-');

        expect(implementerContent).toContain('Do not include `REQ-*` or `DES-*` IDs in test names or code comments');
        expect(implementerContent).not.toContain('tasks prefixed with "Test REQ-"');
    });

    it('requires evidence for design code anatomy and bounded context loading', async () => {
        // Phase skills reference shared content; check both locations
        const designerContent = await readTemplate('universal/skills/spec-driven-technical-designer/SKILL.md');
        const designerTemplateContent = await readTemplate('universal/skills/shared/references/document-templates.md');
        const implementerContent = await readTemplate('universal/skills/spec-driven-task-implementer/SKILL.md');
        const sharedProtocolContent = await readTemplate('universal/skills/shared/references/shared-protocol.md');

        // Designer SKILL.md should reference shared templates
        expect(designerContent).toContain('spec-driven-shared');

        // Shared templates should contain the design table structure
        expect(designerTemplateContent).toContain('| File Path | Status | Evidence | Purpose | Implements |');
        expect(designerTemplateContent).toContain('Verified by Glob/Read');

        // Implementer SKILL.md should have task execution guidance
        expect(implementerContent).toContain('Implement one task by default');

        // Context budget is in shared protocol
        expect(sharedProtocolContent).toContain('Context budget');
    });

    it('requires mandatory repository context preflight in the spec-driven planner', async () => {
        const content = await readTemplate('universal/agents/spec-driven.agent.md');

        expect(content).toContain('### Mandatory Context Preflight');
        expect(content).toContain('Read available project guideline files relevant to the phase');
        expect(content).toContain('Invoke `contextual-stewardship` in `inject` or `retrieve` mode');
        expect(content).toContain('pass repository context into that skill invocation');
        expect(content).toContain('Run the mandatory context preflight for `implementation`');
    });

    it('requires repository-context evidence across spec-driven phase skills and audits', async () => {
        // Phase skills now reference shared templates; audit files keep inline content
        const requirementsSkillContent = await readTemplate('universal/skills/spec-driven-requirements-writer/SKILL.md');
        const designerSkillContent = await readTemplate('universal/skills/spec-driven-technical-designer/SKILL.md');
        const decomposerSkillContent = await readTemplate('universal/skills/spec-driven-task-decomposer/SKILL.md');
        const implementerSkillContent = await readTemplate('universal/skills/spec-driven-task-implementer/SKILL.md');
        const documentTemplatesContent = await readTemplate('universal/skills/shared/references/document-templates.md');
        const auditDesignContent = await readTemplate('universal/skills/agent-work-auditor/artifacts/design.md');
        const auditConsistencyContent = await readTemplate('universal/skills/agent-work-auditor/dimensions/consistency.md');

        // Phase skills should reference shared templates
        expect(requirementsSkillContent).toContain('spec-driven-shared');
        expect(designerSkillContent).toContain('spec-driven-shared');
        expect(decomposerSkillContent).toContain('spec-driven-shared');
        expect(implementerSkillContent).toContain('spec-driven-shared');

        // Shared templates should contain the template structures
        expect(documentTemplatesContent).toContain('## Overview');
        expect(documentTemplatesContent).toContain('## Repository Context Evidence');
        expect(documentTemplatesContent).toContain('## Repository Constraints');

        // Audit files still contain inline content
        expect(auditDesignContent).toContain('Repository Context Evidence shows guidelines');
        expect(auditConsistencyContent).toContain('Missing Repository Evidence');
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
