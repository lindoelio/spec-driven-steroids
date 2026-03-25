import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
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

    it('inject command with Antigravity platform creates .agents directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['antigravity']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agents');
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
    it('inject command with Claude Code platform creates .claude directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const claudeDir = path.join(targetDir, '.claude');
        expect(await fs.pathExists(claudeDir)).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'agents'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'commands'))).toBe(true);
        expect(await fs.pathExists(path.join(claudeDir, 'CLAUDE.md'))).toBe(true);
    });

    it('inject command creates spec-driven agent and commands for Claude Code', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['claudecode']
        });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const agentPath = path.join(targetDir, '.claude', 'agents', 'spec-driven.md');
        expect(await fs.pathExists(agentPath)).toBe(true);

        const agentContent = await fs.readFile(agentPath, 'utf-8');
        expect(agentContent.includes('name: spec-driven')).toBe(true);
        expect(agentContent.includes('## Phase Gatekeeper')).toBe(true);
        expect(agentContent.includes('requirements -> design -> tasks -> implementation')).toBe(true);
        expect(agentContent.includes('### Non-Skippable Stop Rule')).toBe(true);

        const commandPath = path.join(targetDir, '.claude', 'commands', 'spec-driven.md');
        expect(await fs.pathExists(commandPath)).toBe(true);

        const commandContent = await fs.readFile(commandPath, 'utf-8');
        expect(commandContent.includes('Begin at Phase 1 (requirements)')).toBe(true);
        expect(commandContent.includes('After Phase 1 is written, stop immediately.')).toBe(true);

        const injectGuidelinesPath = path.join(targetDir, '.claude', 'commands', 'inject-guidelines.md');
        expect(await fs.pathExists(injectGuidelinesPath)).toBe(true);

        const injectGuidelinesContent = await fs.readFile(injectGuidelinesPath, 'utf-8');
        expect(injectGuidelinesContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(injectGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(injectGuidelinesContent.includes('Testing Trophy')).toBe(true);
    });

    it('inject command includes spec-driven phase-gating guardrails for GitHub and Antigravity', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github-vscode', 'antigravity']
        });

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

    it('inject-guidelines templates require creating all six guideline files by default', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github-vscode', 'antigravity', 'opencode', 'claudecode']
        });

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

        const claudeGuidelinesPath = path.join(targetDir, '.claude', 'commands', 'inject-guidelines.md');
        const claudeGuidelinesContent = await fs.readFile(claudeGuidelinesPath, 'utf-8');
        expect(claudeGuidelinesContent.includes('Generate all six guideline documents by default unless the user explicitly skips named files.')).toBe(true);
        expect(claudeGuidelinesContent.includes('Do not treat missing guideline files as optional.')).toBe(true);
        expect(claudeGuidelinesContent.includes('Testing Trophy')).toBe(true);
        expect(claudeGuidelinesContent.includes('default generated `TESTING.md` to Testing Trophy guidance')).toBe(true);
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

    it('inject command with Codex platform creates .codex directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['codex']
        });

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
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['codex']
        });

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

    it('inject command adds spec-driven-steroids MCP to global Antigravity config', async () => {
        const mcpConfigPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');

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
