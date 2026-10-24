import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';
import { expectIncrementalGuidelinesContract, expectSharedPlannerContract, expectThinEntryPoint, readPlannerContract, readRequiredSkillFiles } from '../helpers/template-test-helpers.js';

describe('CLI E2E: inject command', () => {
    let targetDir: string;
    let originalCwd: string;
    let mockHomeDir: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        targetDir = await mockFs.createTempDir();
        mockHomeDir = await mockFs.createTempDir();
        process.chdir(targetDir);
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        process.env.SDS_TEMPLATE_ALLOWED_HOSTS = 'example.test';
        process.env.SDS_CONFIG_DIR = path.join(mockHomeDir, '.config', 'spec-driven-steroids');
        vi.clearAllMocks();
        vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
        delete process.env.SDS_TEMPLATE_ALLOWED_HOSTS;
        delete process.env.SDS_CONFIG_DIR;
        vi.unstubAllGlobals();
        await mockFs.cleanup();
    });

    it('inject command with GitHub platform creates .github directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);
    });

    it('inject command with JetBrains platform creates .github directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-jetbrains'] });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents', 'spec-driven.agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);

        const jetbrainsAgentContent = await fs.readFile(path.join(githubDir, 'agents', 'spec-driven.agent.md'), 'utf-8');
        const jetbrainsPromptContent = await fs.readFile(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'), 'utf-8');
        expectThinEntryPoint(jetbrainsAgentContent);
        expect(await fs.pathExists(path.join(githubDir, 'skills', 'spec-driven-planner', 'SKILL.md'))).toBe(true);
        expectIncrementalGuidelinesContract(jetbrainsPromptContent);
    });

    it('inject command with GitHub Copilot for VS Code global scope creates artifacts globally', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
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

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(targetDir, '.github'))).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'))).toBe(true);
    });

    it('inject command with Antigravity IDE platform creates .agents directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agents');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
    });

    it('inject command with Antigravity IDE global scope creates artifacts globally', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const globalAntigravityIdeDir = path.join(os.homedir(), '.gemini', 'config');
        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'commands'))).toBe(false);
    });

    it('inject command with Antigravity CLI (AGY) platform creates .agents directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity-cli'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agents');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
    });

    it('inject command with Antigravity CLI (AGY) global scope creates artifacts globally', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity-cli'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const globalAntigravityCliDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
        expect(await fs.pathExists(path.join(globalAntigravityCliDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalAntigravityCliDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalAntigravityCliDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(globalAntigravityCliDir, 'commands'))).toBe(false);
    });

    it('inject command with MiniMax Code platform creates .minimax skills directory (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['minimax-code'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const minimaxDir = path.join(targetDir, '.minimax');
        expect(await fs.pathExists(path.join(minimaxDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(minimaxDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(minimaxDir, 'skills', 'spec-driven-planner', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(minimaxDir, 'skills', 'spec-driven-planner', 'references', 'lane-selection.md'))).toBe(true);
        expect(await fs.pathExists(path.join(minimaxDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(minimaxDir, 'commands'))).toBe(false);
    });

    it('inject command with MiniMax Code global scope writes to the shared Agent Skills directory', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['minimax-code'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const sharedSkillsDir = path.join(os.homedir(), '.agents', 'skills');
        expect(await fs.pathExists(path.join(sharedSkillsDir, 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(sharedSkillsDir, 'spec-driven-planner', 'SKILL.md'))).toBe(true);
    });

    it('inject command displays single unified scope prompt for multiple global-capable platforms', async () => {
        const promptSpy = vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        
        const secondCallArgs = promptSpy.mock.calls[1][0];
        expect(secondCallArgs[0].name).toBe('scope');
        expect(secondCallArgs[0].message).toContain('Injection scope for');
        expect(secondCallArgs[0].message).toContain('OpenCode');
        expect(secondCallArgs[0].message).toContain('Google Antigravity IDE');
    });

    it('inject command with OpenCode platform creates .opencode directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const opencodeDir = path.join(targetDir, '.opencode');
        expect(await fs.pathExists(opencodeDir)).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills', 'spec-driven-brief-planner', 'SKILL.md'))).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails and command shortcut', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
        const agentContent = await fs.readFile(agentPath, 'utf-8');

        expectThinEntryPoint(agentContent);

        const plannerSkillContent = await readPlannerContract(path.join(targetDir, '.opencode', 'skills', 'spec-driven-planner'));
        expectSharedPlannerContract(plannerSkillContent);
        expect(plannerSkillContent.includes('## Lane Selection')).toBe(true);
        expect(plannerSkillContent.includes('### No Direct Lane')).toBe(true);
        expect(plannerSkillContent.includes('In the full lane, before Phase 4 approval, only write the active spec files')).toBe(true);
        expect(plannerSkillContent.includes('SDS requires an approved planning artifact before implementation.')).toBe(true);

        const commandPath = path.join(targetDir, '.opencode', 'commands', 'spec-driven.md');
        const commandContent = await fs.readFile(commandPath, 'utf-8');

        expect(commandContent.includes('agent: Spec-Driven')).toBe(true);
        expectThinEntryPoint(commandContent);
        expect(commandContent.includes('This toolkit has no direct lane')).toBe(true);
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });

    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubAgentPath = path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md');
        const githubAgentContent = await fs.readFile(githubAgentPath, 'utf-8');
        expectThinEntryPoint(githubAgentContent);

        const antigravitySkillPath = path.join(targetDir, '.agents', 'skills', 'spec-driven', 'SKILL.md');
        const antigravitySkillContent = await fs.readFile(antigravitySkillPath, 'utf-8');
        expectThinEntryPoint(antigravitySkillContent);

        for (const root of ['.github', '.agents']) {
            const plannerSkillContent = await readPlannerContract(path.join(targetDir, root, 'skills', 'spec-driven-planner'));
            expectSharedPlannerContract(plannerSkillContent);
            expect(plannerSkillContent.includes('In the full lane, before Phase 4 approval, only write the active spec files')).toBe(true);
        }
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });

    it('inject command keeps spec-driven wrappers phase-aligned across supported platforms', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const entryFiles = [
            path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.agents', 'skills', 'spec-driven', 'SKILL.md'),
            path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'),
            path.join(targetDir, '.codex', 'agents', 'spec-driven.toml')
        ];

        const plannerSkillFiles = [
            path.join(targetDir, '.github', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.agents', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.opencode', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.codex', 'skills', 'spec-driven-planner', 'SKILL.md')
        ];

        for (const plannerSkillFile of plannerSkillFiles) {
            const content = await readPlannerContract(path.dirname(plannerSkillFile));
            expect(content.includes('requirements -> design -> tasks -> Red Team Review -> implementation -> Code Review')).toBe(true);
            expect(content.includes('Non-Skippable Stop Rule')).toBe(true);
        }

        for (const entryFile of entryFiles) {
            expectThinEntryPoint(await fs.readFile(entryFile, 'utf-8'));
        }
    });

    it('inject command prefers remote templates when they are available', async () => {
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
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
                            ...await readRequiredSkillFiles(),
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

        const program = (await import('../../src/cli/index.js')).default;
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

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const injectedAgent = await fs.readFile(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'), 'utf-8');
        expectThinEntryPoint(injectedAgent);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'skills', 'spec-driven-planner', 'SKILL.md'))).toBe(true);
    });

    it('inject command loads continuity guidance at the start of planning phases', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const plannerSkillFiles = [
            path.join(targetDir, '.github', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.agents', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.opencode', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.codex', 'skills', 'spec-driven-planner', 'SKILL.md')
        ];

        for (const plannerSkillFile of plannerSkillFiles) {
            const content = await readPlannerContract(path.dirname(plannerSkillFile));
            expect(content.includes('long-running-work-planning')).toBe(true);
            expect(content.includes('start of each planning phase')).toBe(true);
        }
    });

    it('inject-guidelines templates require incremental review and creation of missing guideline files', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubPromptPath = path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md');
        const githubPromptContent = await fs.readFile(githubPromptPath, 'utf-8');
        expectIncrementalGuidelinesContract(githubPromptContent);
        expect(githubPromptContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(githubPromptContent.includes('Testing Trophy')).toBe(true);
        expect(githubPromptContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        expect(githubPromptContent.includes('agent:')).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'inject-guidelines.agent.md'))).toBe(false);

        const antigravityGuidelinesPath = path.join(targetDir, '.agents', 'skills', 'inject-guidelines', 'SKILL.md');
        const antigravityGuidelinesContent = await fs.readFile(antigravityGuidelinesPath, 'utf-8');
        expectIncrementalGuidelinesContract(antigravityGuidelinesContent);
        expect(antigravityGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(antigravityGuidelinesContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        expect(antigravityGuidelinesContent.includes('agent:')).toBe(false);

        const opencodeGuidelinesPath = path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.md');
        const opencodeGuidelinesContent = await fs.readFile(opencodeGuidelinesPath, 'utf-8');
        expectIncrementalGuidelinesContract(opencodeGuidelinesContent);
        expect(opencodeGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(opencodeGuidelinesContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        expect(opencodeGuidelinesContent.includes('agent: build')).toBe(true);

        expect(await fs.pathExists(path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.command.md'))).toBe(false);

        for (const root of ['.github', '.agents', '.opencode']) {
            const skillPath = path.join(targetDir, root, 'skills', 'project-guidelines-writer', 'SKILL.md');
            expectIncrementalGuidelinesContract(await fs.readFile(skillPath, 'utf-8'));
        }
    });

    it('inject command with OpenCode project scope adds schema to opencode.json', async () => {
        const opencodeConfigPath = path.join(targetDir, 'opencode.json');
        await fs.writeJson(opencodeConfigPath, {});

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(opencodeConfigPath);
        expect(config.$schema).toBe('https://opencode.ai/config.json');
    });

    it('inject command with OpenCode global scope configures all artifacts globally', async () => {
        const globalOpencodeDir = path.join(os.homedir(), '.config', 'opencode');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
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

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const codexDir = path.join(targetDir, '.codex');
        expect(await fs.pathExists(codexDir)).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'skills'))).toBe(true);
    });

    it('inject command creates spec-driven agent and command skills for Codex', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['codex'] });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.codex', 'agents', 'spec-driven.toml');
        expect(await fs.pathExists(agentPath)).toBe(true);

        const agentContent = await fs.readFile(agentPath, 'utf-8');
        expect(agentContent.includes('name = "spec-driven"')).toBe(true);
        expectThinEntryPoint(agentContent);
        expect(await fs.pathExists(path.join(targetDir, '.codex', 'skills', 'spec-driven-planner', 'SKILL.md'))).toBe(true);

        const commandPath = path.join(targetDir, '.codex', 'skills', 'spec-driven', 'SKILL.md');
        expect(await fs.pathExists(commandPath)).toBe(true);

        const commandContent = await fs.readFile(commandPath, 'utf-8');
        expect(commandContent.includes('name: spec-driven')).toBe(true);
        expectThinEntryPoint(commandContent);
        expect(commandContent.includes('Every lane must write and validate a planning artifact')).toBe(true);
        expect(commandContent.includes('{{args}}')).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, '.codex', 'commands', 'spec-driven.md'))).toBe(false);

        const injectGuidelinesPath = path.join(targetDir, '.codex', 'skills', 'inject-guidelines', 'SKILL.md');
        expect(await fs.pathExists(injectGuidelinesPath)).toBe(true);

        const injectGuidelinesContent = await fs.readFile(injectGuidelinesPath, 'utf-8');
        expect(injectGuidelinesContent.includes('name: inject-guidelines')).toBe(true);
        expectIncrementalGuidelinesContract(injectGuidelinesContent);
        expect(injectGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(injectGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.codex', 'commands', 'inject-guidelines.md'))).toBe(false);
    });

    it('inject command with Antigravity IDE global scope creates artifacts at ~/.gemini/config', async () => {
        const globalAntigravityIdeDir = path.join(os.homedir(), '.gemini', 'config');

        if (await fs.pathExists(globalAntigravityIdeDir)) {
            await fs.remove(globalAntigravityIdeDir);
        }

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalAntigravityIdeDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
    });

    it('inject command includes Red Team Review and Code Review in planner templates', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode', 'github-vscode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const plannerSkillFiles = [
            path.join(targetDir, '.opencode', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.github', 'skills', 'spec-driven-planner', 'SKILL.md'),
            path.join(targetDir, '.agents', 'skills', 'spec-driven-planner', 'SKILL.md')
        ];

        for (const plannerSkillFile of plannerSkillFiles) {
            const plannerSkillContent = await readPlannerContract(path.dirname(plannerSkillFile));
            expect(plannerSkillContent).toContain('Red Team Review');
            expect(plannerSkillContent).toContain('Code Review');
            expect(plannerSkillContent).toContain('Unified Quality Gate');
            expect(plannerSkillContent).toContain('Red Team Review: PASS');
        }

        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });

    it('inject command with Claude Code platform creates .claude directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['claudecode'] });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const claudeDir = path.join(targetDir, '.claude');
        expect(await fs.pathExists(claudeDir)).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'commands'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'skills'))).toBe(true);
    });

    it('inject command with Cline platform creates .cline directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['cline'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const clineDir = path.join(targetDir, '.cline');
        expect(await fs.pathExists(clineDir)).toBe(true);
        expect(await fs.pathExists(path.join(clineDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(clineDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(clineDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(clineDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(clineDir, 'commands'))).toBe(false);
    });

    it('inject command with Cline platform global scope creates artifacts globally', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['cline'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const globalClineDir = path.join(os.homedir(), '.cline');
        expect(await fs.pathExists(path.join(globalClineDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(globalClineDir, 'skills', 'spec-driven', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalClineDir, 'skills', 'inject-guidelines', 'SKILL.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalClineDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(globalClineDir, 'commands'))).toBe(false);
    });

    describe('inject output format', () => {
        // Helper: collect all console.log call arguments as plain strings
        function collectOutput(spy: ReturnType<typeof vi.spyOn>): string {
            return spy.mock.calls.map(call => {
                const arg = call[0];
                if (arg && typeof arg.toString === 'function') {
                    // Strip ANSI escape codes
                    return String(arg).replace(/\x1B\[[0-9;]*m/g, '');
                }
                return String(arg);
            }).join('\n');
        }

        it('output contains no emoji characters', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode'] })
                .mockResolvedValueOnce({ scope: 'project' });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
            expect(output).not.toMatch(emojiPattern);
            consoleSpy.mockRestore();
        });

        it('emits one status line per platform', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode', 'gemini-cli'] })
                .mockResolvedValueOnce({ scope: 'global' });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            const statusLines = output.match(/ok \(/g);
            expect(statusLines).toBeTruthy();
            expect(statusLines!.length).toBe(2);
            consoleSpy.mockRestore();
        });

        it('summary includes all platforms with scope and final count', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode', 'gemini-cli', 'qwen-code', 'qoder'] })
                .mockResolvedValueOnce({ scope: 'global' });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            expect(output).toContain('4 platforms configured (global)');
            expect(output).toContain('OpenCode');
            expect(output).toContain('Gemini CLI');
            expect(output).toContain('Qwen Code');
            expect(output).toContain('Qoder CLI / IDE');
            consoleSpy.mockRestore();
        });

        it('remote template version appears in summary', async () => {
            delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input);
                if (url.endsWith('/templates-manifest.json')) {
                    return {
                        ok: true,
                        json: async () => ({
                            version: 'test-version-abc',
                            bundleUrl: 'https://example.test/templates-bundle.json'
                        })
                    } as Response;
                }
                if (url.endsWith('/templates-bundle.json')) {
                    return {
                        ok: true,
                        json: async () => ({
                            version: 'test-version-abc',
                            files: {
                                ...await readRequiredSkillFiles(),
                                'universal/agents/spec-driven.agent.md': '---\nname: Spec-Driven\n---\n\ncontent',
                                'universal/commands/spec-driven.command.md': '---\ndescription: Test\n---\n\ncontent',
                                'universal/commands/inject-guidelines.command.md': '---\ndescription: Test\n---\n\ncontent'
                            }
                        })
                    } as Response;
                }
                throw new Error(`Unexpected fetch: ${url}`);
            }));

            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode'] })
                .mockResolvedValueOnce({ scope: 'project' });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            expect(output).toContain('Templates: remote (test-version-abc)');
            vi.unstubAllGlobals();
            consoleSpy.mockRestore();
        });

        it('bundled fallback warning appears in summary', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.stubGlobal('fetch', vi.fn(async () => ({
                ok: false,
                status: 503
            }) as Response));

            process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';

            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode'] })
                .mockResolvedValueOnce({ scope: 'project' });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            expect(output).toContain('fallback');
            delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
            vi.unstubAllGlobals();
            consoleSpy.mockRestore();
        });

        it('reports project scope for project-only platforms', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['codex'] });

            const program = (await import('../../src/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            const output = collectOutput(consoleSpy);
            expect(output).toContain('OpenAI Codex');
            expect(output).toContain('(project)');
            expect(output).not.toContain('OpenAI Codex            global');
            consoleSpy.mockRestore();
        });
    });

    it.each(['inject', 'repair', 'templates'])('uses the same incomplete-skill guard for %s', async action => {
        const { createProgram } = await import('../../src/cli/index.js');
        const program = createProgram();
        if (action === 'repair') {
            await program.parseAsync(['inject', '--platform', 'opencode', '--scope', 'project', '--yes'], { from: 'user' });
        }
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
            ok: true,
            json: async () => String(input).endsWith('/templates-manifest.json')
                ? { version: 'incomplete-skills', bundleUrl: 'https://example.test/templates-bundle.json' }
                : {
                    version: 'incomplete-skills',
                    files: {
                        'universal/agents/spec-driven.agent.md': 'REMOTE BROKEN ROUTER',
                        'universal/commands/spec-driven.command.md': 'REMOTE BROKEN COMMAND',
                        'universal/commands/inject-guidelines.command.md': 'REMOTE GUIDELINES'
                    }
                }
        }) as Response));
        try {
            const args = action === 'inject'
                ? ['inject', '--platform', 'opencode', '--scope', 'project', '--yes']
                : action === 'repair' ? ['repair', '--project'] : ['templates', 'info', '--json'];
            await program.parseAsync(args, { from: 'user' });
            if (action === 'templates') {
                const info = JSON.parse(String(log.mock.calls[0][0]));
                expect(info.source).toBe('bundled');
                expect(info.fallbackReason).toContain('spec-driven-planner/SKILL.md');
            } else {
                const entry = await fs.readFile(path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md'), 'utf8');
                expectThinEntryPoint(entry);
                expect(entry).not.toContain('REMOTE BROKEN ROUTER');
                expect(await fs.pathExists(path.join(targetDir, '.opencode', 'skills', 'spec-driven-planner', 'references', 'lane-selection.md'))).toBe(true);
            }
        } finally {
            log.mockRestore();
        }
    });

    it('reports failure when a remote template bundle is missing a required file', async () => {
        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/templates-manifest.json')) {
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: async () => JSON.stringify({
                        version: 'broken-remote',
                        bundleUrl: 'https://example.test/templates-bundle.json'
                    })
                } as Response;
            }
            if (url.endsWith('/templates-bundle.json')) {
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: async () => JSON.stringify({
                        version: 'broken-remote',
                        files: {
                            ...await readRequiredSkillFiles(),
                            'universal/commands/spec-driven.command.md': '---\ndescription: Test\n---\n\nCOMMAND ONLY'
                        }
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch: ${url}`);
        }));

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' });

        const program = (await import('../../src/cli/index.js')).default;
        process.exitCode = 0;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(process.exitCode).toBe(1);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'))).toBe(false);

        process.exitCode = 0;
        vi.unstubAllGlobals();
    });
});
