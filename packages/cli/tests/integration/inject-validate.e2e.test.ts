import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: inject command', () => {
    let targetDir: string;
    let originalCwd: string;
    let mockHomeDir: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        targetDir = await mockFs.createTempDir();
        mockHomeDir = await mockFs.createTempDir();
        process.chdir(targetDir);
        vi.clearAllMocks();
        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        vi.unstubAllGlobals();
        await mockFs.cleanup();
    });

    it('inject command with GitHub platform creates .github directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);
    });

    it('inject command with JetBrains platform creates .github directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-jetbrains'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents', 'spec-driven.agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);

        const jetbrainsAgentContent = await fs.readFile(path.join(githubDir, 'agents', 'spec-driven.agent.md'), 'utf-8');
        const jetbrainsPromptContent = await fs.readFile(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'), 'utf-8');
        expect(jetbrainsAgentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(jetbrainsPromptContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
    });

    it('inject command with GitHub Copilot for VS Code global scope creates artifacts globally', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const globalVSCodeDir = (() => {
            if (process.platform === 'win32') {
                const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
                return path.join(appData, 'Code', 'User');
            } else if (process.platform === 'darwin') {
                return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
            }
            return path.join(os.homedir(), '.config', 'Code', 'User');
        })();

        expect(await fs.pathExists(path.join(globalVSCodeDir, 'prompts'))).toBe(true);

        const copilotSkillsDir = process.platform === 'win32'
            ? path.join(process.env.USERPROFILE || os.homedir(), '.copilot', 'skills')
            : path.join(os.homedir(), '.copilot', 'skills');
        expect(await fs.pathExists(copilotSkillsDir)).toBe(true);

        expect(await fs.pathExists(path.join(targetDir, '.github'))).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, '.vscode'))).toBe(false);
    });

    it('inject command with GitHub Copilot for JetBrains skips global scope prompt and uses project-level injection', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-jetbrains'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(targetDir, '.github'))).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'))).toBe(true);
    });

    it('inject command with Antigravity platform creates .agents directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agents');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'workflows'))).toBe(true);
    });

    it('inject command with Antigravity skips global scope prompt and uses project-level injection', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(targetDir, '.agents'))).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.agents', 'workflows', 'spec-driven.md'))).toBe(true);
    });

    it('inject command skips scope prompt for Antigravity and proceeds directly to project-level injection', async () => {
        const promptSpy = vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(promptSpy).toHaveBeenCalledTimes(1);
    });

    it('inject command displays single unified scope prompt for multiple global-capable platforms', async () => {
        const promptSpy = vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        
        const secondCallArgs = promptSpy.mock.calls[1][0];
        expect(secondCallArgs[0].name).toBe('scope');
        expect(secondCallArgs[0].message).toContain('Injection scope for');
        expect(secondCallArgs[0].message).toContain('OpenCode');
        expect(secondCallArgs[0].message).not.toContain('Antigravity');
    });

    it('inject command with OpenCode platform creates .opencode directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const opencodeDir = path.join(targetDir, '.opencode');
        expect(await fs.pathExists(opencodeDir)).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills'))).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails and command shortcut', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
        const agentContent = await fs.readFile(agentPath, 'utf-8');

        expect(agentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(agentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(agentContent.includes('Before Phase 4 approval, only write files under `.specs/changes/<slug>/`.')).toBe(true);
        expect(agentContent.includes('I can implement this, but per Spec-Driven flow I must start with Phase 1 (requirements) first.')).toBe(true);
        expect(agentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const commandPath = path.join(targetDir, '.opencode', 'commands', 'spec-driven.md');
        const commandContent = await fs.readFile(commandPath, 'utf-8');

        expect(commandContent.includes('agent: Spec-Driven')).toBe(true);
        expect(commandContent.includes('Begin at Phase 1 (requirements)')).toBe(true);
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });

    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubAgentPath = path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md');
        const githubAgentContent = await fs.readFile(githubAgentPath, 'utf-8');
        expect(githubAgentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(githubAgentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(githubAgentContent.includes('Before Phase 4 approval, only write files under `.specs/changes/<slug>/`.')).toBe(true);
        expect(githubAgentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const antigravityWorkflowPath = path.join(targetDir, '.agents', 'workflows', 'spec-driven.md');
        const antigravityWorkflowContent = await fs.readFile(antigravityWorkflowPath, 'utf-8');
        expect(antigravityWorkflowContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(antigravityWorkflowContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(antigravityWorkflowContent.includes('Before Phase 4 approval, only write files under `.specs/changes/<slug>/`.')).toBe(true);
        expect(antigravityWorkflowContent.includes('### Non-Skippable Stop Rule')).toBe(true);
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });

    it('inject command keeps spec-driven wrappers phase-aligned across supported platforms', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const plannerFiles = [
            path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.agents', 'workflows', 'spec-driven.md'),
            path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.codex', 'agents', 'spec-driven.toml')
        ];

        for (const plannerFile of plannerFiles) {
            const content = await fs.readFile(plannerFile, 'utf-8');
            expect(content.includes('requirements -> design -> tasks -> implementation')).toBe(true);
            expect(content.includes('Approve Phase 1, and I\'ll move to Phase 2 (design).')).toBe(true);
            expect(content.includes('Approve Phase 2, and I\'ll move to Phase 3 (tasks).')).toBe(true);
            expect(content.includes('Approve Phase 3, and I\'ll move to Phase 4 (implementation).')).toBe(true);
        }
    });

    it('inject command prefers remote templates when they are available', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/templates-manifest.json')) {
                return {
                    ok: true,
                    json: async () => ({
                        version: 'remote-test-version',
                        bundleUrl: 'https://example.test/templates-bundle.json'
                    })
                } as Response;
            }

            if (url.endsWith('/templates-bundle.json')) {
                return {
                    ok: true,
                    json: async () => ({
                        version: 'remote-test-version',
                        files: {
                            'universal/agents/spec-driven.agent.md': '---\nname: Spec-Driven\n---\n\nREMOTE SPEC-DRIVEN AGENT\n\n## Phase Gatekeeper\n\nTest content.',
                            'universal/commands/inject-guidelines.command.md': '---\ndescription: Test\n---\n\nREMOTE INJECT GUIDELINES\n\nGenerate all six guideline documents by default.',
                            'universal/commands/spec-driven.command.md': '---\ndescription: Test\n---\n\nREMOTE SPEC-DRIVEN COMMAND',
                            'universal/skills/long-running-work-planning/SKILL.md': 'REMOTE CONTINUITY SKILL'
                        }
                    })
                } as Response;
            }

            throw new Error(`Unexpected fetch: ${url}`);
        }));

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const injectedAgent = await fs.readFile(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'), 'utf-8');
        const injectedPrompt = await fs.readFile(path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md'), 'utf-8');
        const injectedSkill = await fs.readFile(path.join(targetDir, '.github', 'skills', 'long-running-work-planning', 'SKILL.md'), 'utf-8');

        expect(injectedAgent).toContain('REMOTE SPEC-DRIVEN AGENT');
        expect(injectedPrompt).toContain('REMOTE INJECT GUIDELINES');
        expect(injectedSkill).toBe('REMOTE CONTINUITY SKILL');
    });

    it('inject command falls back to bundled templates when remote retrieval fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable'
        }) as Response));

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const injectedAgent = await fs.readFile(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'), 'utf-8');
        expect(injectedAgent.includes('## Phase Gatekeeper')).toBe(true);
    });

    it('inject command loads continuity guidance at the start of planning phases', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const plannerFiles = [
            path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.agents', 'workflows', 'spec-driven.md'),
            path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.codex', 'agents', 'spec-driven.toml')
        ];

        for (const plannerFile of plannerFiles) {
            const content = await fs.readFile(plannerFile, 'utf-8');
            expect(content.includes('long-running-work-planning')).toBe(true);
            expect(content.includes('start of each planning phase')).toBe(true);
        }
    });

    it('inject-guidelines templates require creating all six guideline files by default', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubPromptPath = path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md');
        const githubPromptContent = await fs.readFile(githubPromptPath, 'utf-8');
        expect(githubPromptContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(githubPromptContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(githubPromptContent.includes('Testing Trophy')).toBe(true);
        expect(githubPromptContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'inject-guidelines.agent.md'))).toBe(false);

        const antigravityGuidelinesPath = path.join(targetDir, '.agents', 'workflows', 'inject-guidelines.md');
        const antigravityGuidelinesContent = await fs.readFile(antigravityGuidelinesPath, 'utf-8');
        expect(antigravityGuidelinesContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(antigravityGuidelinesContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);

        const opencodeGuidelinesPath = path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.md');
        const opencodeGuidelinesContent = await fs.readFile(opencodeGuidelinesPath, 'utf-8');
        expect(opencodeGuidelinesContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(opencodeGuidelinesContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        
        expect(await fs.pathExists(path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.command.md'))).toBe(false);
    });

    it('inject command with OpenCode project scope adds schema to opencode.json', async () => {
        const opencodeConfigPath = path.join(targetDir, 'opencode.json');
        await fs.writeJson(opencodeConfigPath, {});

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(opencodeConfigPath);
        expect(config.$schema).toBe('https://opencode.ai/config.json');
    });

    it('inject command with OpenCode global scope configures all artifacts globally', async () => {
        const globalOpencodeDir = path.join(os.homedir(), '.config', 'opencode');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(globalOpencodeDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'agents', 'spec-driven.agent.md'))).toBe(true);

        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'spec-driven.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'inject-guidelines.md'))).toBe(true);
        
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'inject-guidelines.command.md'))).toBe(false);

        expect(await fs.pathExists(path.join(globalOpencodeDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'skills', 'long-running-work-planning', 'SKILL.md'))).toBe(true);

        expect(await fs.pathExists(path.join(targetDir, '.opencode'))).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, 'opencode.json'))).toBe(false);
    });

    it('inject command with Codex platform creates .codex directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['codex'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const codexDir = path.join(targetDir, '.codex');
        expect(await fs.pathExists(codexDir)).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'commands'))).toBe(true);
    });

    it('inject command creates spec-driven agent and commands for Codex', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['codex'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.codex', 'agents', 'spec-driven.toml');
        expect(await fs.pathExists(agentPath)).toBe(true);

        const agentContent = await fs.readFile(agentPath, 'utf-8');
        expect(agentContent.includes('name = "spec-driven"')).toBe(true);
        expect(agentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(agentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(agentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const commandPath = path.join(targetDir, '.codex', 'commands', 'spec-driven.md');
        expect(await fs.pathExists(commandPath)).toBe(true);

        const commandContent = await fs.readFile(commandPath, 'utf-8');
        expect(commandContent.includes('Begin at Phase 1 (requirements)')).toBe(true);
        expect(commandContent.includes('After Phase 1 is written, stop immediately.')).toBe(true);

        const injectGuidelinesPath = path.join(targetDir, '.codex', 'commands', 'inject-guidelines.md');
        expect(await fs.pathExists(injectGuidelinesPath)).toBe(true);

        const injectGuidelinesContent = await fs.readFile(injectGuidelinesPath, 'utf-8');
        expect(injectGuidelinesContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(injectGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(injectGuidelinesContent.includes('Testing Trophy')).toBe(true);
    });

    it('inject command with Antigravity does not create global artifacts directory', async () => {
        const globalAntigravityDir = path.join(os.homedir(), '.gemini', 'antigravity');
        const globalWorkflowsPath = path.join(globalAntigravityDir, 'workflows');

        if (await fs.pathExists(globalAntigravityDir)) {
            await fs.remove(globalAntigravityDir);
        }

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(globalWorkflowsPath)).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, '.agents'))).toBe(true);
    });

    it('inject command with Claude Code platform creates .claude directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['claudecode'] });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const claudeDir = path.join(targetDir, '.claude');
        expect(await fs.pathExists(claudeDir)).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'commands'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'skills'))).toBe(true);
    });
});
