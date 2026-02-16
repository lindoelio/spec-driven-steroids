import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: inject command', () => {
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

    it('inject command with GitHub platform creates .github directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);
    });

    it('inject command with JetBrains platform creates .jetbrains directory structure from canonical Copilot templates', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['jetbrains']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const jetbrainsDir = path.join(targetDir, '.jetbrains');
        expect(await fs.pathExists(jetbrainsDir)).toBe(true);
        expect(await fs.pathExists(path.join(jetbrainsDir, 'agents', 'spec-driven.agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(jetbrainsDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);

        const jetbrainsAgentContent = await fs.readFile(path.join(jetbrainsDir, 'agents', 'spec-driven.agent.md'), 'utf-8');
        const jetbrainsPromptContent = await fs.readFile(path.join(jetbrainsDir, 'prompts', 'inject-guidelines.prompt.md'), 'utf-8');
        expect(jetbrainsAgentContent.includes('## Phase Gatekeeper (Non-Bypassable)')).toBe(true);
        expect(jetbrainsPromptContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
    });

    it('inject command with Antigravity platform creates .agent directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['antigravity']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agent');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'workflows'))).toBe(true);
    });

    it('inject command with OpenCode platform creates .opencode directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['opencode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const opencodeDir = path.join(targetDir, '.opencode');
        expect(await fs.pathExists(opencodeDir)).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills'))).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails and command shortcut', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['opencode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.opencode', 'agents', 'spec-driven.agent.md');
        const agentContent = await fs.readFile(agentPath, 'utf-8');

        expect(agentContent.includes('## Phase Gatekeeper (Non-Bypassable)')).toBe(true);
        expect(agentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(agentContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);
        expect(agentContent.includes('I can implement this, but per Spec-Driven flow I must start with Phase 1 (requirements) first.')).toBe(true);

        const commandPath = path.join(targetDir, '.opencode', 'commands', 'spec-driven.md');
        const commandContent = await fs.readFile(commandPath, 'utf-8');

        expect(commandContent.includes('agent: spec-driven')).toBe(true);
        expect(commandContent.includes('Begin at Phase 1 (requirements)')).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github', 'antigravity']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubAgentPath = path.join(targetDir, '.github', 'agents', 'spec-driven.agent.md');
        const githubAgentContent = await fs.readFile(githubAgentPath, 'utf-8');
        expect(githubAgentContent.includes('## Phase Gatekeeper (Non-Bypassable)')).toBe(true);
        expect(githubAgentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(githubAgentContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);

        const antigravityWorkflowPath = path.join(targetDir, '.agent', 'workflows', 'spec-driven.md');
        const antigravityWorkflowContent = await fs.readFile(antigravityWorkflowPath, 'utf-8');
        expect(antigravityWorkflowContent.includes('## Phase Gatekeeper (Non-Bypassable)')).toBe(true);
        expect(antigravityWorkflowContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(antigravityWorkflowContent.includes('Before Phase 4 approval, only write files under `specs/changes/<slug>/`.')).toBe(true);
    });

    it('inject-guidelines templates require creating all six guideline files by default', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github', 'antigravity', 'opencode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubPromptPath = path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md');
        const githubPromptContent = await fs.readFile(githubPromptPath, 'utf-8');
        expect(githubPromptContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(githubPromptContent.includes('Never report missing guideline files as optional.')).toBe(true);
        // GitHub agent shim is intentionally removed in favor of the Copilot prompt
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'inject-guidelines.agent.md'))).toBe(false);

        const antigravityGuidelinesPath = path.join(targetDir, '.agent', 'workflows', 'inject-guidelines.md');
        const antigravityGuidelinesContent = await fs.readFile(antigravityGuidelinesPath, 'utf-8');
        expect(antigravityGuidelinesContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Never report missing guideline files as optional.')).toBe(true);

        const opencodeGuidelinesPath = path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.md');
        const opencodeGuidelinesContent = await fs.readFile(opencodeGuidelinesPath, 'utf-8');
        expect(opencodeGuidelinesContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Never report missing guideline files as optional.')).toBe(true);
    });

    it('inject command adds spec-driven-steroids MCP to OpenCode config', async () => {
        const opencodeConfigPath = path.join(targetDir, 'opencode.json');
        await fs.writeJson(opencodeConfigPath, {});

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['opencode']
        });

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

    it('inject command adds spec-driven-steroids MCP to GitHub Copilot config', async () => {
        const mcpConfigPath = path.join(targetDir, '.vscode', 'mcp.json');

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github']
        });

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

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.servers).toBeDefined();
        expect(config.servers.existing).toBeDefined();
        expect(config.servers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers).toBeUndefined();
    });

    it('inject command adds spec-driven-steroids MCP to Antigravity config', async () => {
        const mcpConfigPath = path.join(targetDir, '.agent', 'mcp_config.json');

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['antigravity']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids'].command).toBe('node');
        expect(config.mcpServers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
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
        const agentDir = path.join(targetDir, '.agent');
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
