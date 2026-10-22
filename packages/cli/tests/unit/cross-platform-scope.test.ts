import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

import {
  getGitHubCopilotCliGlobalConfigDir,
  getGitHubCopilotCliUserSkillsDir
} from '../../src/cli/github-copilot-cli-scope.js';
import { getVSCodeGlobalPromptsDir } from '../../src/cli/github-copilot-scope.js';
import { getOpenCodeGlobalConfigDir } from '../../src/cli/opencode-scope.js';

describe('Unit: cross-platform scope paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.APPDATA;
    delete process.env.USERPROFILE;
  });

  it('resolves GitHub Copilot CLI paths on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';
    process.env.USERPROFILE = 'C:\\Users\\test';

    expect(getGitHubCopilotCliGlobalConfigDir()).toBe(
      path.join('C:\\Users\\test\\AppData\\Roaming', 'github-copilot')
    );
    expect(getGitHubCopilotCliUserSkillsDir()).toBe(
      path.join('C:\\Users\\test\\AppData\\Roaming', 'github-copilot', 'skills')
    );
  });

  it('resolves GitHub Copilot CLI paths on Linux', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('HOME', '/home/test');

    expect(getGitHubCopilotCliGlobalConfigDir()).toBe('/home/test/.config/github-copilot');
  });

  it('resolves VS Code prompts path on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';

    expect(getVSCodeGlobalPromptsDir()).toBe(
      path.join('C:\\Users\\test\\AppData\\Roaming', 'Code', 'User', 'prompts')
    );
  });

  it('resolves OpenCode global config under the home directory', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('HOME', '/home/test');

    expect(getOpenCodeGlobalConfigDir()).toBe('/home/test/.config/opencode');
  });
});
