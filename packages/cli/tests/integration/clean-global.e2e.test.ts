import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('CLI E2E: clean --global command', () => {
    let targetDir: string;
    let originalCwd: string;
    let mockHomeDir: string;

    const getGlobalOpencodeDir = () => path.join(os.homedir(), '.config', 'opencode');
    const getGlobalOpencodeConfigPath = () => path.join(getGlobalOpencodeDir(), 'opencode.json');

    const getVSCodeMcpPath = () => {
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            return path.join(appData, 'Code', 'User', 'mcp.json');
        }
        if (process.platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
        }
        return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
    };

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

    it('clean --global preserves other MCP entries in OpenCode opencode.json', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();

        // Pre-populate global opencode.json with multiple MCP entries
        await fs.ensureDir(configDir);
        await fs.writeJson(configPath, {
            theme: 'dark',
            mcp: {
                'spec-driven-steroids': {
                    type: 'local',
                    command: ['node', '/path/to/server.js']
                },
                'my-other-server': {
                    type: 'local',
                    command: ['node', '/path/to/other.js']
                },
                'third-server': {
                    type: 'remote',
                    url: 'https://example.com/mcp'
                }
            },
            provider: {
                openai: { apiKey: 'test-key' }
            }
        }, { spaces: 2 });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        const config = await fs.readJson(configPath);

        // spec-driven-steroids should be removed
        expect(config.mcp['spec-driven-steroids']).toBeUndefined();

        // All other MCP entries should be preserved
        expect(config.mcp['my-other-server']).toBeDefined();
        expect(config.mcp['my-other-server'].command).toEqual(['node', '/path/to/other.js']);
        expect(config.mcp['third-server']).toBeDefined();
        expect(config.mcp['third-server'].url).toBe('https://example.com/mcp');

        // Non-MCP config should be preserved
        expect(config.theme).toBe('dark');
        expect(config.provider).toBeDefined();
        expect(config.provider.openai.apiKey).toBe('test-key');
    });

    it('clean --global preserves other MCP entries in VS Code mcp.json', async () => {
        const mcpPath = getVSCodeMcpPath();
        const mcpDir = path.dirname(mcpPath);

        // Pre-populate VS Code mcp.json with multiple entries
        await fs.ensureDir(mcpDir);
        await fs.writeJson(mcpPath, {
            servers: {
                'spec-driven-steroids': {
                    command: 'node',
                    args: ['/path/to/server.js']
                },
                'my-existing-server': {
                    command: 'node',
                    args: ['/path/to/existing.js']
                }
            },
            mcpServers: {
                'legacy-server': {
                    command: 'npx',
                    args: ['some-package']
                }
            }
        }, { spaces: 2 });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        const config = await fs.readJson(mcpPath);

        // spec-driven-steroids should be removed
        expect(config.servers['spec-driven-steroids']).toBeUndefined();

        // Other servers should be preserved
        expect(config.servers['my-existing-server']).toBeDefined();
        expect(config.servers['my-existing-server'].command).toBe('node');

        // Legacy mcpServers entries should be preserved
        expect(config.mcpServers['legacy-server']).toBeDefined();
    });

    it('clean --global does not rewrite opencode.json when steroids entry does not exist', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();

        // Pre-populate with NO steroids entry
        await fs.ensureDir(configDir);
        const originalContent = JSON.stringify({
            theme: 'dark',
            mcp: {
                'my-server': {
                    type: 'local',
                    command: ['node', 'server.js']
                }
            }
        }, null, 2) + '\n';

        await fs.writeFile(configPath, originalContent, 'utf-8');
        const originalMtime = (await fs.stat(configPath)).mtimeMs;

        // Small delay to ensure mtime would differ if file was written
        await new Promise(resolve => setTimeout(resolve, 50));

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        const newMtime = (await fs.stat(configPath)).mtimeMs;

        // File should NOT have been rewritten
        expect(newMtime).toBe(originalMtime);

        // Content should be unchanged
        const content = await fs.readFile(configPath, 'utf-8');
        expect(content).toBe(originalContent);
    });

    it('clean --global handles BOM in opencode.json and preserves other entries', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();

        await fs.ensureDir(configDir);

        // Write config with BOM prefix
        const configObj = {
            mcp: {
                'spec-driven-steroids': {
                    type: 'local',
                    command: ['node', '/path/to/server.js']
                },
                'other-server': {
                    type: 'local',
                    command: ['node', '/path/to/other.js']
                }
            }
        };
        const contentWithBom = '\uFEFF' + JSON.stringify(configObj, null, 2);
        await fs.writeFile(configPath, contentWithBom, 'utf-8');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        const rawContent = await fs.readFile(configPath, 'utf-8');
        // Should not have BOM after rewrite
        expect(rawContent.startsWith('\uFEFF')).toBe(false);

        const config = JSON.parse(rawContent);
        expect(config.mcp['spec-driven-steroids']).toBeUndefined();
        expect(config.mcp['other-server']).toBeDefined();
        expect(config.mcp['other-server'].command).toEqual(['node', '/path/to/other.js']);
    });

    it('clean --global preserves trailing newline in opencode.json', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();

        await fs.ensureDir(configDir);

        // Write config WITH trailing newline (as fs.writeJson does)
        const configObj = {
            mcp: {
                'spec-driven-steroids': {
                    type: 'local',
                    command: ['node', '/path/to/server.js']
                }
            }
        };
        await fs.writeFile(configPath, JSON.stringify(configObj, null, 2) + '\n', 'utf-8');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        const rawContent = await fs.readFile(configPath, 'utf-8');
        expect(rawContent.endsWith('\n')).toBe(true);
    });
});

describe('CLI E2E: inject --global preserves existing MCP entries', () => {
    let targetDir: string;
    let originalCwd: string;
    let mockHomeDir: string;

    const getGlobalOpencodeDir = () => path.join(os.homedir(), '.config', 'opencode');
    const getGlobalOpencodeConfigPath = () => path.join(getGlobalOpencodeDir(), 'opencode.json');

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

    it('inject --global with OpenCode preserves existing MCP entries in opencode.json', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();

        // Pre-populate with existing MCP entries
        await fs.ensureDir(configDir);
        await fs.writeJson(configPath, {
            theme: 'dark',
            mcp: {
                'my-existing-server': {
                    type: 'local',
                    command: ['node', '/path/to/existing.js']
                },
                'another-server': {
                    type: 'remote',
                    url: 'https://example.com/mcp'
                }
            },
            provider: { openai: { apiKey: 'test-key' } }
        }, { spaces: 2 });

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['opencode'] })
            .mockResolvedValueOnce({ scope: 'global' })
            .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
            .mockResolvedValueOnce({ addMemoryMcp: false });

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        const config = await fs.readJson(configPath);

        // Note: spec-driven-steroids MCP server is no longer added - CLI has been replaced with validate command

        // Existing entries should be preserved
        expect(config.mcp['my-existing-server']).toBeDefined();
        expect(config.mcp['my-existing-server'].command).toEqual(['node', '/path/to/existing.js']);
        expect(config.mcp['another-server']).toBeDefined();
        expect(config.mcp['another-server'].url).toBe('https://example.com/mcp');

        // Non-MCP config should be preserved
        expect(config.theme).toBe('dark');
        expect(config.provider.openai.apiKey).toBe('test-key');
    });

    it('inject --global with OpenCode aborts when opencode.json has invalid JSON', async () => {
        const configPath = getGlobalOpencodeConfigPath();
        const configDir = getGlobalOpencodeDir();
        const backupPath = configPath + '.test-backup';

        // Backup any existing config
        let hadExistingConfig = false;
        if (await fs.pathExists(configPath)) {
            await fs.copy(configPath, backupPath);
            hadExistingConfig = true;
        }

        try {
            // Pre-populate with invalid JSON
            await fs.ensureDir(configDir);
            await fs.writeFile(configPath, '{ "mcp": { "bad": } }', 'utf-8');

            vi.spyOn(inquirer, 'prompt')
                .mockResolvedValueOnce({ platforms: ['opencode'] })
                .mockResolvedValueOnce({ scope: 'global' })
                .mockResolvedValueOnce({ addSequentialThinkingMcp: false })
                .mockResolvedValueOnce({ addMemoryMcp: false });

            const program = (await import('../../dist/cli/index.js')).default;
            await program.parseAsync(['inject'], { from: 'user' } as any);

            // File should NOT be overwritten — original invalid content preserved
            const content = await fs.readFile(configPath, 'utf-8');
            expect(content).toBe('{ "mcp": { "bad": } }');
        } finally {
            // Restore original config to avoid poisoning other tests
            if (hadExistingConfig) {
                await fs.move(backupPath, configPath, { overwrite: true });
            } else {
                await fs.remove(configPath).catch(() => {});
            }
        }
    });
});
