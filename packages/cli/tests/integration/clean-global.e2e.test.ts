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

    it('clean --global removes OpenCode global skills and agents', async () => {
        const configDir = getGlobalOpencodeDir();
        await fs.ensureDir(configDir);

        await fs.outputFile(path.join(configDir, 'agents', 'spec-driven.agent.md'), 'agent');
        await fs.outputFile(path.join(configDir, 'commands', 'spec-driven.command.md'), 'command');
        await fs.outputFile(path.join(configDir, 'commands', 'spec-driven.md'), 'command');
        await fs.outputFile(path.join(configDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(configDir, 'agents', 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'commands', 'spec-driven.command.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'commands', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes Gemini CLI global artifacts', async () => {
        const geminiDir = path.join(os.homedir(), '.gemini');

        await fs.outputFile(path.join(geminiDir, 'agents', 'spec-driven.md'), 'agent');
        await fs.outputFile(path.join(geminiDir, 'commands', 'spec-driven.toml'), 'command');
        await fs.outputFile(path.join(geminiDir, 'commands', 'inject-guidelines.toml'), 'command');
        await fs.outputFile(path.join(geminiDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(geminiDir, 'agents', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(geminiDir, 'commands', 'spec-driven.toml'))).toBe(false);
        expect(await fs.pathExists(path.join(geminiDir, 'commands', 'inject-guidelines.toml'))).toBe(false);
        expect(await fs.pathExists(path.join(geminiDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes GitHub Copilot CLI global artifacts', async () => {
        const copilotCliDir = path.join(os.homedir(), '.config', 'github-copilot');

        await fs.outputFile(path.join(copilotCliDir, 'agents', 'spec-driven.agent.md'), 'agent');
        await fs.outputFile(path.join(copilotCliDir, 'commands', 'spec-driven.md'), 'command');
        await fs.outputFile(path.join(copilotCliDir, 'commands', 'inject-guidelines.md'), 'command');
        await fs.outputFile(path.join(copilotCliDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(copilotCliDir, 'agents', 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(copilotCliDir, 'commands', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(copilotCliDir, 'commands', 'inject-guidelines.md'))).toBe(false);
        expect(await fs.pathExists(path.join(copilotCliDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes Qwen Code global artifacts', async () => {
        const qwenDir = path.join(os.homedir(), '.qwen');

        await fs.outputFile(path.join(qwenDir, 'skills', 'spec-driven.md'), 'agent');
        await fs.outputFile(path.join(qwenDir, 'skills', 'inject-guidelines.md'), 'command');
        await fs.outputFile(path.join(qwenDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'inject-guidelines.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes GitHub Copilot for VS Code global artifacts', async () => {
        const promptsDir = process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
            : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');
        const skillsDir = path.join(os.homedir(), '.copilot', 'skills');

        await fs.outputFile(path.join(promptsDir, 'spec-driven.agent.md'), 'agent');
        await fs.outputFile(path.join(promptsDir, 'spec-driven.prompt.md'), 'prompt');
        await fs.outputFile(path.join(skillsDir, 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../dist/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.prompt.md'))).toBe(false);
        expect(await fs.pathExists(path.join(skillsDir, 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global handles missing directories gracefully', async () => {
        const program = (await import('../../dist/cli/index.js')).default;

        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        // Should not throw
    });
});
