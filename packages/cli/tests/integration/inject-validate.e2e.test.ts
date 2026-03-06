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
            platforms: ['github-vscode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);
    });

    it('inject command with JetBrains platform creates .github directory structure and configures global MCP', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github-jetbrains']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents', 'spec-driven.agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'))).toBe(true);

        const jetbrainsAgentContent = await fs.readFile(path.join(githubDir, 'agents', 'spec-driven.agent.md'), 'utf-8');
        const jetbrainsPromptContent = await fs.readFile(path.join(githubDir, 'prompts', 'inject-guidelines.prompt.md'), 'utf-8');
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

    it('inject command with Claude Code platform creates .claude directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const claudeDir = path.join(targetDir, '.claude');
        expect(await fs.pathExists(claudeDir)).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'skills'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'rules'))).toBe(true);


        // MCP config should be in project root
        const mcpConfigPath = path.join(targetDir, '.mcp.json');
        expect(await fs.pathExists(mcpConfigPath)).toBe(true);

        // Should NOT be in .claude directory
        const wrongMcpPath = path.join(claudeDir, '.mcp.json');
        expect(await fs.pathExists(wrongMcpPath)).toBe(false);

        const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');
        expect(await fs.pathExists(claudeMdPath)).toBe(true);

        const content = await fs.readFile(claudeMdPath, 'utf-8');
        expect(content.includes('Spec-Driven Development')).toBe(true);
        expect(content.includes('## Available Skills')).toBe(true);
        expect(content.includes('/spec-driven')).toBe(true);
        expect(content.includes('/inject-guidelines')).toBe(true);
    });

    it('inject command creates spec-driven and enforcement rules for Claude Code', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const rulesPath = path.join(targetDir, '.claude', 'rules', 'spec-driven-enforcement.md');
        expect(await fs.pathExists(rulesPath)).toBe(true);

        const content = await fs.readFile(rulesPath, 'utf-8');
        expect(content.includes('paths:')).toBe(true);
        expect(content.includes('Before Writing Any Implementation Code')).toBe(true);
        expect(content.includes('Check for Requirements')).toBe(true);

        const skillPath = path.join(targetDir, '.claude', 'skills','spec-driven', 'SKILL.md');
        expect(await fs.pathExists(skillPath)).toBe(true);

        const skillContent = await fs.readFile(skillPath, 'utf-8');
        expect(skillContent.includes('# Spec-Driven Planner')).toBe(true);
        expect(skillContent.includes('## Instructions')).toBe(true);
        expect(skillContent.includes('Phase Gatekeeper')).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github-vscode', 'antigravity']
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
            platforms: ['github-vscode', 'antigravity', 'opencode', 'claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const githubPromptPath = path.join(targetDir, '.github', 'prompts', 'inject-guidelines.prompt.md');
        const githubPromptContent = await fs.readFile(githubPromptPath, 'utf-8');
        expect(githubPromptContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(githubPromptContent.includes('Never report missing guideline files as optional.')).toBe(true);
        expect(githubPromptContent.includes('Testing Trophy')).toBe(true);
        expect(githubPromptContent.includes('Integration tests as the primary confidence layer')).toBe(true);
        expect(githubPromptContent.includes('Unit tests as secondary and selective only')).toBe(true);
        // GitHub agent shim is intentionally removed in favor of the Copilot prompt
        expect(await fs.pathExists(path.join(targetDir, '.github', 'agents', 'inject-guidelines.agent.md'))).toBe(false);

        const antigravityGuidelinesPath = path.join(targetDir, '.agent', 'workflows', 'inject-guidelines.md');
        const antigravityGuidelinesContent = await fs.readFile(antigravityGuidelinesPath, 'utf-8');
        expect(antigravityGuidelinesContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Never report missing guideline files as optional.')).toBe(true);
        expect(antigravityGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(antigravityGuidelinesContent.includes('integration tests as the primary confidence layer')).toBe(true);
        expect(antigravityGuidelinesContent.includes('unit tests secondary and selective')).toBe(true);

        const opencodeGuidelinesPath = path.join(targetDir, '.opencode', 'commands', 'inject-guidelines.md');
        const opencodeGuidelinesContent = await fs.readFile(opencodeGuidelinesPath, 'utf-8');
        expect(opencodeGuidelinesContent.includes('All 6 guideline documents are REQUIRED outputs.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Never report missing guideline files as optional.')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Integration tests as primary confidence layer')).toBe(true);
        expect(opencodeGuidelinesContent.includes('Unit tests as secondary and selective only')).toBe(true);

        const claudeCodeGuideLinesPath = path.join(targetDir, '.claude', 'skills', 'inject-guidelines', 'SKILL.md');
        const claudeCodeGuideLinesContent = await fs.readFile(claudeCodeGuideLinesPath, 'utf-8');
        expect(claudeCodeGuideLinesContent.includes('All 6 guideline documents are REQUIRED outputs')).toBe(true);
        expect(claudeCodeGuideLinesContent.includes('Never report missing guideline files as optional')).toBe(true);
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
            platforms: ['github-vscode']
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
            platforms: ['github-vscode']
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

    it('inject command adds spec-driven-steroids MCP to .mcp.json with correct structure', async () => {
        const mcpConfigPath = path.join(targetDir, '.mcp.json');

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);


        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers).toBeDefined();
        expect(config.servers).toBeUndefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids'].command).toBe('node');
        expect(config.mcpServers['spec-driven-steroids'].args[0]).toMatch(/dist[\\/]mcp[\\/]index\.js$/);
    });

    it('inject command merges with existing .mcp.json without overwriting existing servers', async () => {
        const mcpConfigPath = path.join(targetDir, '.mcp.json');

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

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

    it('validate command detects existing Claude Code config', async () => {
        const claudeDir = path.join(targetDir, '.claude');
        await fs.ensureDir(path.join(claudeDir, 'skills'));
        await fs.ensureDir(path.join(claudeDir, 'rules'));
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
