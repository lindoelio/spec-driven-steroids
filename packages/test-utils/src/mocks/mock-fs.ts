import { promises as fsPromises } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export interface MockTargetDirOptions {
    platforms: string[];
    mcpServers?: string[];
    existingConfig?: {
        mcpServers?: Record<string, unknown>;
    };
}

export class MockFileSystem {
    private tempDirs: Set<string> = new Set();

    /**
     * Create a temporary directory for testing
     */
    async createTempDir(): Promise<string> {
        const tempPath = path.join(tmpdir(), `spec-driven-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fsPromises.mkdir(tempPath, { recursive: true });
        this.tempDirs.add(tempPath);
        return tempPath;
    }

    /**
     * Create a spec directory structure with given files
     */
    async createTempSpec(
        slug: string,
        files: Record<string, string>,
        basePath?: string
    ): Promise<string> {
        const rootDir = basePath || await this.createTempDir();
        const specDir = path.join(rootDir, 'specs', 'changes', slug);
        await fsPromises.mkdir(specDir, { recursive: true });

        for (const [filename, content] of Object.entries(files)) {
            const filePath = path.join(specDir, filename);
            await fsPromises.writeFile(filePath, content, 'utf-8');
        }

        return rootDir;
    }

    /**
     * Create a mock target directory with platform configs
     */
    async createMockTargetDir(options: MockTargetDirOptions): Promise<string> {
        const rootDir = await this.createTempDir();

        for (const platform of options.platforms) {
            if (platform === 'github') {
                await this.createGithubConfig(rootDir, options);
            } else if (platform === 'antigravity') {
                await this.createAntigravityConfig(rootDir, options);
            } else if (platform === 'opencode') {
                await this.createOpenCodeConfig(rootDir, options);
            }
        }

        return rootDir;
    }

    /**
     * Create GitHub Copilot config structure
     */
    private async createGithubConfig(rootDir: string, options: MockTargetDirOptions): Promise<void> {
        const vscodeDir = path.join(rootDir, '.vscode');
        await fsPromises.mkdir(vscodeDir, { recursive: true });

        const config: Record<string, unknown> = options.existingConfig?.mcpServers
            ? { mcpServers: options.existingConfig.mcpServers }
            : { mcpServers: {} };

        await fsPromises.writeFile(
            path.join(vscodeDir, 'mcp.json'),
            JSON.stringify(config, null, 2),
            'utf-8'
        );
    }

    /**
     * Create Antigravity config structure
     */
    private async createAntigravityConfig(rootDir: string, options: MockTargetDirOptions): Promise<void> {
        const agentDir = path.join(rootDir, '.agent');
        await fsPromises.mkdir(agentDir, { recursive: true });

        const config: Record<string, unknown> = options.existingConfig?.mcpServers
            ? { mcpServers: options.existingConfig.mcpServers }
            : { mcpServers: {} };

        await fsPromises.writeFile(
            path.join(agentDir, 'mcp_config.json'),
            JSON.stringify(config, null, 2),
            'utf-8'
        );
    }

    /**
     * Create OpenCode config structure
     */
    private async createOpenCodeConfig(rootDir: string, options: MockTargetDirOptions): Promise<void> {
        const config: Record<string, unknown> = {
            name: 'test-project',
            skills: [],
            mcpServers: options.existingConfig?.mcpServers || {}
        };

        await fsPromises.writeFile(
            path.join(rootDir, 'opencode.json'),
            JSON.stringify(config, null, 2),
            'utf-8'
        );
    }

    /**
     * Read a file from the mock filesystem
     */
    async readFile(filePath: string): Promise<string> {
        return await fsPromises.readFile(filePath, 'utf-8');
    }

    /**
     * Write a file to the mock filesystem
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        const dir = path.dirname(filePath);
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(filePath, content, 'utf-8');
    }

    /**
     * Check if a path exists
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            await fsPromises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clean up all temporary directories
     */
    async cleanup(): Promise<void> {
        for (const dir of this.tempDirs) {
            try {
                await fsPromises.rm(dir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
        this.tempDirs.clear();
    }

    /**
     * Get list of created temp directories
     */
    getTempDirs(): string[] {
        return Array.from(this.tempDirs);
    }
}

export const mockFs = new MockFileSystem();
