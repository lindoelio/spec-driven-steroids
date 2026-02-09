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
        }).mockResolvedValueOnce({
            mcpServers: []
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        expect(await fs.pathExists(githubDir)).toBe(true);
        expect(await fs.pathExists(path.join(githubDir, 'agents'))).toBe(true);
    });

    it('inject command with Antigravity platform creates .agent directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['antigravity']
        }).mockResolvedValueOnce({
            mcpServers: []
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const agentDir = path.join(targetDir, '.agent');
        expect(await fs.pathExists(agentDir)).toBe(true);
        expect(await fs.pathExists(path.join(agentDir, 'workflows'))).toBe(true);
    });

    it('inject command with OpenCode platform creates .opencode directory structure', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['opencode']
        }).mockResolvedValueOnce({
            mcpServers: []
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const opencodeDir = path.join(targetDir, '.opencode');
        expect(await fs.pathExists(opencodeDir)).toBe(true);
        expect(await fs.pathExists(path.join(opencodeDir, 'skills'))).toBe(true);
    });

    it('inject command updates opencode.json with injected skills', async () => {
        const opencodeConfigPath = path.join(targetDir, 'opencode.json');
        await fs.writeJson(opencodeConfigPath, {
            name: 'test-project',
            skills: [],
            mcpServers: {}
        });

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['opencode']
        }).mockResolvedValueOnce({
            mcpServers: []
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const config = await fs.readJson(opencodeConfigPath);
        expect(config.skills.length).toBeGreaterThan(0);
        expect(config.skills.some((skill: string) => skill.includes('spec-driven'))).toBe(true);
    });

    it('inject command with MCP servers adds them to config', async () => {
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github']
        }).mockResolvedValueOnce({
            mcpServers: ['github', 'linear']
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const mcpConfigPath = path.join(targetDir, '.vscode', 'mcp.json');
        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers.github).toBeDefined();
        expect(config.mcpServers.linear).toBeDefined();
    });

    it('inject command merges with existing MCP config', async () => {
        const vscodeDir = path.join(targetDir, '.vscode');
        await fs.ensureDir(vscodeDir);
        const mcpConfigPath = path.join(vscodeDir, 'mcp.json');
        await fs.writeJson(mcpConfigPath, {
            mcpServers: {
                'existing-server': {
                    command: 'custom',
                    args: []
                }
            }
        });

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
            platforms: ['github']
        }).mockResolvedValueOnce({
            mcpServers: ['github']
        });

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'inject'], { from: 'user' } as any);

        const config = await fs.readJson(mcpConfigPath);
        expect(config.mcpServers['existing-server']).toBeDefined();
        expect(config.mcpServers['spec-driven-steroids']).toBeDefined();
        expect(config.mcpServers.github).toBeDefined();
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

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'validate'], { from: 'user' } as any);

        const githubDirExists = await fs.pathExists(githubDir);
        expect(githubDirExists).toBe(true);
    });

    it('validate command detects existing Antigravity config', async () => {
        const agentDir = path.join(targetDir, '.agent');
        await fs.ensureDir(path.join(agentDir, 'workflows'));

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'validate'], { from: 'user' } as any);

        const agentDirExists = await fs.pathExists(agentDir);
        expect(agentDirExists).toBe(true);
    });

    it('validate command detects existing OpenCode config', async () => {
        const opencodeDir = path.join(targetDir, '.opencode');
        await fs.ensureDir(path.join(opencodeDir, 'skills'));

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'validate'], { from: 'user' } as any);

        const opencodeDirExists = await fs.pathExists(opencodeDir);
        expect(opencodeDirExists).toBe(true);
    });

    it('validate command detects specs directory', async () => {
        const specsDir = path.join(targetDir, 'specs');
        await fs.ensureDir(specsDir);

        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'validate'], { from: 'user' } as any);

        const specsDirExists = await fs.pathExists(specsDir);
        expect(specsDirExists).toBe(true);
    });

    it('validate command shows correct status for missing configs', async () => {
        const program = (await import('../../dist/index.js')).default;
        program.parse(['node', 'index.js', 'validate'], { from: 'user' } as any);

        const githubDir = path.join(targetDir, '.github');
        const githubDirExists = await fs.pathExists(githubDir);
        expect(githubDirExists).toBe(false);
    });
});
