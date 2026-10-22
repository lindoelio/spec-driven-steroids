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
        await fs.outputFile(path.join(configDir, 'skills', 'spec-driven-brief-planner', 'SKILL.md'), 'skill');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(configDir, 'agents', 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'commands', 'spec-driven.command.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'commands', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'skills', 'long-running-work-planning'))).toBe(false);
        expect(await fs.pathExists(path.join(configDir, 'skills', 'spec-driven-brief-planner'))).toBe(false);
    });

    it('clean --global removes Gemini CLI global artifacts', async () => {
        const geminiDir = path.join(os.homedir(), '.gemini');

        await fs.outputFile(path.join(geminiDir, 'agents', 'spec-driven.md'), 'agent');
        await fs.outputFile(path.join(geminiDir, 'commands', 'spec-driven.toml'), 'command');
        await fs.outputFile(path.join(geminiDir, 'commands', 'inject-guidelines.toml'), 'command');
        await fs.outputFile(path.join(geminiDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../src/cli/index.js')).default;
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

        const program = (await import('../../src/cli/index.js')).default;
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

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'inject-guidelines.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qwenDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes Qoder global artifacts', async () => {
        const qoderDir = path.join(os.homedir(), '.qoder');

        await fs.outputFile(path.join(qoderDir, 'agents', 'spec-driven.md'), 'agent');
        await fs.outputFile(path.join(qoderDir, 'commands', 'spec-driven.md'), 'command');
        await fs.outputFile(path.join(qoderDir, 'commands', 'inject-guidelines.md'), 'command');
        await fs.outputFile(path.join(qoderDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(qoderDir, 'agents', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qoderDir, 'commands', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qoderDir, 'commands', 'inject-guidelines.md'))).toBe(false);
        expect(await fs.pathExists(path.join(qoderDir, 'skills', 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global removes Cline global artifacts', async () => {
        const clineDir = path.join(os.homedir(), '.cline');

        // New layout: skills-based
        await fs.outputFile(path.join(clineDir, 'skills', 'spec-driven', 'SKILL.md'), 'agent-skill');
        await fs.outputFile(path.join(clineDir, 'skills', 'inject-guidelines', 'SKILL.md'), 'command-skill');
        await fs.outputFile(path.join(clineDir, 'skills', 'long-running-work-planning', 'SKILL.md'), 'skill');

        // Legacy layout (backward compat)
        await fs.outputFile(path.join(clineDir, 'agents', 'spec-driven.agent.md'), 'agent');
        await fs.outputFile(path.join(clineDir, 'commands', 'spec-driven.md'), 'command');
        await fs.outputFile(path.join(clineDir, 'commands', 'inject-guidelines.md'), 'command');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        // New layout cleaned
        expect(await fs.pathExists(path.join(clineDir, 'skills', 'spec-driven'))).toBe(false);
        expect(await fs.pathExists(path.join(clineDir, 'skills', 'inject-guidelines'))).toBe(false);
        expect(await fs.pathExists(path.join(clineDir, 'skills', 'long-running-work-planning'))).toBe(false);

        // Legacy layout cleaned
        expect(await fs.pathExists(path.join(clineDir, 'agents', 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(clineDir, 'commands', 'spec-driven.md'))).toBe(false);
        expect(await fs.pathExists(path.join(clineDir, 'commands', 'inject-guidelines.md'))).toBe(false);
    });

    it('clean --global removes GitHub Copilot for VS Code global artifacts', async () => {
        const promptsDir = process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
            : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');
        const skillsDir = path.join(os.homedir(), '.copilot', 'skills');

        await fs.outputFile(path.join(promptsDir, 'spec-driven.agent.md'), 'agent');
        await fs.outputFile(path.join(promptsDir, 'spec-driven.prompt.md'), 'prompt');
        await fs.outputFile(path.join(skillsDir, 'long-running-work-planning', 'SKILL.md'), 'skill');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.prompt.md'))).toBe(false);
        expect(await fs.pathExists(path.join(skillsDir, 'long-running-work-planning'))).toBe(false);
    });

    it('clean --global handles missing directories gracefully', async () => {
        const program = (await import('../../src/cli/index.js')).default;

        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        // Should not throw
    });

    it('clean --global does NOT modify ~/.agents/skills/', async () => {
        const aliasDir = path.join(os.homedir(), '.agents', 'skills');
        await fs.ensureDir(aliasDir);
        await fs.outputFile(path.join(aliasDir, 'some-external-skill', 'SKILL.md'), 'external skill content');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(aliasDir, 'some-external-skill', 'SKILL.md'))).toBe(true);
        const content = await fs.readFile(path.join(aliasDir, 'some-external-skill', 'SKILL.md'), 'utf-8');
        expect(content).toBe('external skill content');
    });

    it('clean --global preserves unrelated user files in shared prompt directories', async () => {
        const promptsDir = process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
            : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');

        await fs.outputFile(path.join(promptsDir, 'agents', 'user-agent.md'), 'user agent');
        await fs.outputFile(path.join(promptsDir, 'prompts', 'user-prompt.md'), 'user prompt');
        await fs.outputFile(path.join(promptsDir, 'spec-driven.agent.md'), 'sds agent');
        await fs.outputFile(path.join(promptsDir, 'spec-driven.prompt.md'), 'sds prompt');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(promptsDir, 'agents', 'user-agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(promptsDir, 'prompts', 'user-prompt.md'))).toBe(true);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.agent.md'))).toBe(false);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.prompt.md'))).toBe(false);
    });

    it('clean --global preserves custom Antigravity workflows', async () => {
        const workflowsDir = path.join(os.homedir(), '.gemini', 'config', 'workflows');
        await fs.outputFile(path.join(workflowsDir, 'custom.yaml'), 'name: custom');

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['clean', '--global', '--yes'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(workflowsDir, 'custom.yaml'))).toBe(true);
    });

    it('global VS Code inject only flattens SDS-owned files', async () => {
        process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES = 'true';
        const promptsDir = process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
            : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');

        await fs.outputFile(path.join(promptsDir, 'agents', 'user-agent.md'), 'user agent');
        await fs.outputFile(path.join(promptsDir, 'prompts', 'user-prompt.md'), 'user prompt');

        vi.spyOn(inquirer, 'prompt')
            .mockResolvedValueOnce({ platforms: ['github-vscode'] })
            .mockResolvedValueOnce({ scope: 'global' });

        const program = (await import('../../src/cli/index.js')).default;
        await program.parseAsync(['inject'], { from: 'user' } as any);

        expect(await fs.pathExists(path.join(promptsDir, 'agents', 'user-agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(promptsDir, 'prompts', 'user-prompt.md'))).toBe(true);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.agent.md'))).toBe(true);
        expect(await fs.pathExists(path.join(promptsDir, 'spec-driven.prompt.md'))).toBe(true);

        delete process.env.SPEC_DRIVEN_USE_BUNDLED_TEMPLATES;
    });
});
