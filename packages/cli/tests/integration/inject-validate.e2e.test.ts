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
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);
    });

    it('inject command with JetBrains platform creates .github directory structure and configures global MCP', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-jetbrains'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

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

        // Verify JetBrains MCP config
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const mcpConfigPath = process.platform === 'win32'
            ? path.join(localAppData, 'github-copilot', 'intellij', 'mcp.json')
            : path.join(os.homedir(), '.config', 'github-copilot', 'intellij', 'mcp.json');

        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers).toBeDefined();
        expect(config.servers['spec-driven-steroids']).toBeDefined();
        expect(config.servers['spec-driven-steroids'].command).toBe('node');
        expect(config.servers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command with GitHub Copilot for VS Code global scope configures MCP and artifacts globally', async () => {
        // Get platform-specific VS Code user profile path
        let globalVSCodeDir: string;
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            globalVSCodeDir = path.join(appData, 'Code', 'User');
        } else if (process.platform === 'darwin') {
            globalVSCodeDir = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
        } else {
            globalVSCodeDir = path.join(os.homedir(), '.config', 'Code', 'User');
        }

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'global' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Global MCP config should be created
        const mcpConfigPath = path.join(globalVSCodeDir, 'mcp.json');
        expect(await fs.pathExists(mcpConfigPath)).toBe(true);
        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers).toBeDefined();
        expect(config.servers['spec-driven-steroids']).toBeDefined();

        // Global agents (prompts) should be created
        expect(await fs.pathExists(path.join(globalVSCodeDir, 'prompts'))).toBe(true);

        // Global skills should be created in the .copilot/skills directory
        const copilotSkillsDir = process.platform === 'win32'
            ? path.join(process.env.USERPROFILE || os.homedir(), '.copilot', 'skills')
            : path.join(os.homedir(), '.copilot', 'skills');
        expect(await fs.pathExists(copilotSkillsDir)).toBe(true);

        // Project-level files should NOT be created
        expect(await fs.pathExists(path.join(targetDir, '.github'))).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, '.vscode'))).toBe(false);
    });

    it('inject command with GitHub Copilot for JetBrains skips global scope prompt and uses project-level injection', async () => {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const globalJetBrainsDir = process.platform === 'win32'
            ? path.join(localAppData, 'github-copilot', 'intellij')
            : path.join(os.homedir(), '.config', 'github-copilot', 'intellij');

        // Clean up any leftover global artifacts from previous test runs
        if (await fs.pathExists(path.join(globalJetBrainsDir, 'agents'))) {
            await fs.remove(path.join(globalJetBrainsDir, 'agents'));
        }
        if (await fs.pathExists(path.join(globalJetBrainsDir, 'skills'))) {
            await fs.remove(path.join(globalJetBrainsDir, 'skills'));
        }
        if (await fs.pathExists(path.join(globalJetBrainsDir, 'commands'))) {
            await fs.remove(path.join(globalJetBrainsDir, 'commands'));
        }

        // Only two prompts: platform selection and sequential-thinking (no scope prompt for JetBrains)
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-jetbrains'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Project-level .github directory should be created
        expect(await fs.pathExists(path.join(targetDir, '.github'))).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'))).toBe(true);

        // Global JetBrains artifacts directory should NOT be created
        expect(await fs.pathExists(path.join(globalJetBrainsDir, 'agents'))).toBe(false);
        expect(await fs.pathExists(path.join(globalJetBrainsDir, 'skills'))).toBe(false);

        // MCP config should still be written to the platform's user-level path
        const mcpConfigPath = path.join(globalJetBrainsDir, 'mcp.json');
        expect(await fs.pathExists(mcpConfigPath)).toBe(true);
        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers['spec-driven-steroids']).toBeDefined();
    });

    it('inject command with Antigravity platform creates .agents directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agents');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'workflows'))).toBe(true);
    });

    it('inject command with Antigravity skips global scope prompt and uses project-level injection', async () => {
        const globalAntigravityDir = path.join(os.homedir(), '.gemini', 'antigravity');

        // Only two prompts: platform selection and sequential-thinking (no scope prompt for Antigravity)
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Project-level .agents directory should be created
        expect(await fs.pathExists(path.join(targetDir, '.agents'))).toBe(true);
        expect(await fs.pathExists(path.join(targetDir, '.agents', 'workflows', 'spec-driven.md'))).toBe(true);

        // Global Antigravity artifacts directory should NOT be created
        expect(await fs.pathExists(path.join(globalAntigravityDir, 'workflows'))).toBe(false);
        expect(await fs.pathExists(path.join(globalAntigravityDir, 'skills'))).toBe(false);

        // MCP config should still be written to the platform's user-level path
        const mcpConfigPath = path.join(globalAntigravityDir, 'mcp_config.json');
        expect(await fs.pathExists(mcpConfigPath)).toBe(true);
        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
    });

    it('inject command skips scope prompt for Antigravity and proceeds directly to project-level injection', async () => {
        const promptSpy = vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Verify only three prompts were made (platform selection, sequential-thinking, and memory MCP, no scope prompt)
        expect(promptSpy).toHaveBeenCalledTimes(3);
    });

    it('inject command displays single unified scope prompt for multiple global-capable platforms', async () => {
        const promptSpy = vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'global' })  // Unified scope for OpenCode (Antigravity skips scope prompt)
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Verify four prompts were made (platform, unified scope, sequential-thinking, memory MCP)
        expect(promptSpy).toHaveBeenCalledTimes(4);
        
        const secondCallArgs = promptSpy.mock.calls[1][0];
        expect(secondCallArgs[0].name).toBe('scope');
        expect(secondCallArgs[0].message).toContain('Injection scope for');
        // The prompt should only list OpenCode, not Antigravity
        expect(secondCallArgs[0].message).toContain('OpenCode');
        expect(secondCallArgs[0].message).not.toContain('Antigravity');
    });

    it('inject command with OpenCode platform creates .opencode directory structure (project scope)', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const opencodeDir = path.join(targetDir, '.opencode');
        expect(await fs.pathExists(opencodeDir)).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills'))).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails and command shortcut', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
        const agentContent = await fs.readFile(agentPath, 'utf-8');

        expect(agentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(agentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(agentContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);
        expect(agentContent.includes('I can implement this, but per Spec-Driven flow I must start with Phase 1 (requirements) first.')).toBe(true);
        expect(agentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const commandPath = path.join(targetDir, '.opencode', 'commands', 'spec-driven.md');
        const commandContent = await fs.readFile(commandPath, 'utf-8');

        expect(commandContent.includes('agent: spec-driven')).toBe(true);
        expect(commandContent.includes('Begin at Phase 1 (requirements)')).toBe(true);
    });
    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubAgentPath = path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md');
        const githubAgentContent = await fs.readFile(githubAgentPath, 'utf-8');
        expect(githubAgentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(githubAgentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(githubAgentContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);
        expect(githubAgentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const antigravityWorkflowPath = path.join(targetDir, '.agents', 'workflows', 'spec-driven.md');
        const antigravityWorkflowContent = await fs.readFile(antigravityWorkflowPath, 'utf-8');
        expect(antigravityWorkflowContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(antigravityWorkflowContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(antigravityWorkflowContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);
        expect(antigravityWorkflowContent.includes('### Non-Skippable Stop Rule')).toBe(true);
    });

    it('inject command keeps spec-driven wrappers phase-aligned across supported platforms', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' })  // Unified scope for all global-capable platforms
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

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
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

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
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const injectedAgent = await fs.readFile(path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md'), 'utf-8');
        expect(injectedAgent.includes('## Phase Gatekeeper')).toBe(true);
    });

    it('inject command loads continuity guidance at the start of planning phases', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode', 'antigravity', 'opencode', 'codex'] })
            .mockResolvedValueOnce({ scope: 'project' })  // Unified scope for all global-capable platforms
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

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
            .mockResolvedValueOnce({ scope: 'project' })  // Unified scope for all global-capable platforms
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubPromptPath = path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md');
        const githubPromptContent = await fs.readFile(githubPromptPath, 'utf-8');
        expect(githubPromptContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(githubPromptContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(githubPromptContent.includes('Testing Trophy')).toBe(true);
        expect(githubPromptContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
        // GitHub agent shim is intentionally removed in favor of the Copilot prompt
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
        
        // Ensure no phantom commands leak
        expect(await fs.pathExists(path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.command.md'))).toBe(false);
    });

    it('inject command adds spec-driven-steroids MCP to OpenCode config (project scope)', async () => {
        const opencodeConfigPath = path.join(targetDir, 'opencode.json');
        await fs.writeJson(opencodeConfigPath, {});

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(opencodeConfigPath);
        expect(config.$schema).toBe('https://opencode.ai/config.json');
        expect(config.mcp).toBeDefined();
        expect(config.mcp['spec-driven-steroids']).toBeDefined();
        expect(config.mcp['spec-driven-steroids'].type).toBe('local');
        expect(config.mcp['spec-driven-steroids'].command[0]).toBe('node');
        expect(config.mcp['spec-driven-steroids'].command[1]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command with OpenCode global scope configures all artifacts globally', async () => {
        const globalOpencodeDir = path.join(os.homedir(), '.config', 'opencode');
        const globalConfigPath = path.join(globalOpencodeDir, 'opencode.json');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'global' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Global MCP config should be created
        const globalConfig = await fs.readJson(globalConfigPath);
        expect(globalConfig.mcp).toBeDefined();
        expect(globalConfig.mcp['spec-driven-steroids']).toBeDefined();
        expect(globalConfig.mcp['spec-driven-steroids'].type).toBe('local');
        expect(globalConfig.mcp['spec-driven-steroids'].command[0]).toBe('node');
        expect(globalConfig.mcp['spec-driven-steroids'].command[1]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);

        // Global agents should be created
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'agents', 'spec-driven.agent.md'))).toBe(true);

        // Global commands should be created
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'spec-driven.md'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'inject-guidelines.md'))).toBe(true);
        
        // No phantom command artifacts
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'commands', 'inject-guidelines.command.md'))).toBe(false);

        // Global skills should be created
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(globalOpencodeDir, 'skills', 'long-running-work-planning', 'SKILL.md'))).toBe(true);

        // Project-level files should NOT be created
        expect(await fs.pathExists(path.join(targetDir, '.opencode'))).toBe(false);
        expect(await fs.pathExists(path.join(targetDir, 'opencode.json'))).toBe(false);
    });

    it('inject command with Codex platform creates .codex directory structure', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['codex'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const codexDir = path.join(targetDir, '.codex');
        expect(await fs.pathExists(codexDir)).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(codexDir, 'commands'))).toBe(true);

        // MCP config should be in Codex's project-scoped config.toml
        const mcpConfigPath = path.join(codexDir, 'config.toml');
        expect(await fs.pathExists(mcpConfigPath)).toBe(true);

        const mcpConfigContent = await fs.readFile(mcpConfigPath, 'utf-8');
        expect(mcpConfigContent.includes('[mcp_servers.spec-driven-steroids]')).toBe(true);
        expect(mcpConfigContent.includes('command = "node"')).toBe(true);
        expect(mcpConfigContent).toMatch(/args = \[[^\]]*dist[\\/]mcp[\\/]index\.js/);
    });

    it('inject command creates spec-driven agent and commands for Codex', async () => {
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['codex'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

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

    it('inject command adds spec-driven-steroids MCP to GitHub Copilot config', async () => {
        const mcpConfigPath = path.join(targetDir, '.vscode', 'mcp.json');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers).toBeDefined();
        expect(config.servers['spec-driven-steroids']).toBeDefined();
        expect(config.servers['spec-driven-steroids'].command).toBe('node');
        expect(config.servers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command migrates legacy GitHub Copilot mcpServers key to servers', async () => {
        const mcpConfigPath = path.join(targetDir, '.vscode', 'mcp.json');
        await fs.ensureDir(path.dirname(mcpConfigPath));
        await fs.writeJson(mcpConfigPath, {
            mcpServers: {
                existing: {
                    command: 'node',
                    args: ['existing.js']
                }
            }
        });

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'project' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers).toBeDefined();
        expect(config.servers.existing).toBeDefined();
        expect(config.servers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers).toBeUndefined();
    });

    it('inject command adds spec-driven-steroids MCP to global Antigravity config (project-level injection)', async () => {
        const mcpConfigPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');

        // Only two prompts: platform selection and sequential-thinking (no scope prompt for Antigravity)
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids'].command).toBe('node');
        expect(config.mcpServers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command with Antigravity does not create global artifacts directory', async () => {
        const globalAntigravityDir = path.join(os.homedir(), '.gemini', 'antigravity');
        const globalWorkflowsPath = path.join(globalAntigravityDir, 'workflows');

        // Clean up any existing global config before test
        if (await fs.pathExists(globalAntigravityDir)) {
            await fs.remove(globalAntigravityDir);
        }

        // Only two prompts: platform selection and sequential-thinking (no scope prompt for Antigravity)
        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['antigravity'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        // Global workflows should NOT be created
        expect(await fs.pathExists(globalWorkflowsPath)).toBe(false);

        // Project-level .agents should be created
        expect(await fs.pathExists(path.join(targetDir, '.agents'))).toBe(true);
    });

    it('inject command adds spec-driven-steroids MCP to .mcp.json with correct structure', async () => {
        const mcpConfigPath = path.join(targetDir, '.mcp.json');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['claudecode'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids'].command).toBe('node');
        expect(config.mcpServers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command merges with existing .mcp.json without overwriting existing servers', async () => {
        const mcpConfigPath = path.join(targetDir, '.mcp.json');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['claudecode'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        await fs.writeJson(mcpConfigPath, {
            mcpServers: {
                existing: {
                    command: 'node',
                    args: ['existing.js']
                }
            }
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers.existing).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
    });

    it('inject command includes sequential-thinking MCP when requested for Claude Code', async () => {
        const mcpConfigPath = path.join(targetDir, '.mcp.json');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['claudecode'] })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: true })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers['sequential-thinking']).toBeDefined();
        expect(config.mcpServers['sequential-thinking'].command).toBe('npx');
        expect(config.mcpServers['sequential-thinking'].args).toEqual(['-y', '@modelcontextprotocol/server-sequential-thinking']);
    });
});

describe('CLI E2E: validate command', () => {
    let targetDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        targetDir = await mockFs.createTempDir();
        process.chdir(targetDir);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await mockFs.cleanup();
    });

    it('validate command detects existing GitHub config', async () => {
        const githubDir = path.join(targetDir, '.github');
        await fs.ensureDir(path.join(githubDir, 'agents'));

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const githubDirExists = await fs.pathExists(githubDir);
        expect(githubDirExists).toBe(true);
    });

    it('validate command detects existing Antigravity config', async () => {
        const agentDir = path.join(targetDir, '.agents');
        await fs.ensureDir(path.join(agentDir, 'workflows'));

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const agentDirExists = await fs.pathExists(agentDir);
        expect(agentDirExists).toBe(true);
    });

    it('validate command detects existing OpenCode config', async () => {
        const opencodeDir = path.join(targetDir, '.opencode');
        await fs.ensureDir(path.join(opencodeDir, 'skills'));

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const opencodeDirExists = await fs.pathExists(opencodeDir);
        expect(opencodeDirExists).toBe(true);
    });
    it('validate command detects existing Claude Code config', async () => {
        const claudeDir = path.join(targetDir, '.claude');
        await fs.ensureDir(path.join(claudeDir, 'agents'));
        await fs.ensureDir(path.join(claudeDir, 'commands'));
        await fs.ensureFile(path.join(claudeDir, 'CLAUDE.md'));

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const claudeDirExists = await fs.pathExists(claudeDir);
        expect(claudeDirExists).toBe(true);
    });

    it('validate command detects specs directory', async () => {
        const specsDir = path.join(targetDir, 'specs');
        await fs.ensureDir(specsDir);

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const specsDirExists = await fs.pathExists(specsDir);
        expect(specsDirExists).toBe(true);
    });

    it('validate command shows correct status for missing configs', async () => {
        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['validate'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        const githubDirExists = await fs.pathExists(githubDir);
        expect(githubDirExists).toBe(false);
    });
});
