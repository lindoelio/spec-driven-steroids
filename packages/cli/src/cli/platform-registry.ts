import path from 'path';

import { PLATFORM_CONFIGS, type PlatformConfig } from './platform-config.js';
import { getCopilotGlobalSkillsDir, getVSCodeGlobalPromptsDir } from './github-copilot-scope.js';
import { getGitHubCopilotCliGlobalConfigDir, getGitHubCopilotCliUserSkillsDir } from './github-copilot-cli-scope.js';
import { getOpenCodeGlobalConfigDir } from './opencode-scope.js';
import { getQoderGlobalConfigDir } from './qoder-scope.js';

export type InjectionScope = 'global' | 'project';

export interface PlatformContext {
  cwd: string;
  home: string;
}

export type PlatformPostProcess = 'flatten-vscode-prompts' | 'remove-codex-legacy-commands';

export interface PlatformDefinition {
  id: string;
  displayName: string;
  supportedScopes: InjectionScope[];
  config: PlatformConfig;
  resolveRoot(scope: InjectionScope, context: PlatformContext): string;
  resolveSkillsRoot(scope: InjectionScope, context: PlatformContext): string;
  skipOutputTypes?: string[];
  postProcess?: PlatformPostProcess;
}

function projectRoot(context: PlatformContext, directory: string): string {
  return path.join(context.cwd, directory);
}

function globalRoot(context: PlatformContext, ...segments: string[]): string {
  return path.join(context.home, ...segments);
}

function projectSkillsRoot(root: string): string {
  return path.join(root, 'skills');
}

export const PLATFORM_DEFINITIONS: Record<string, PlatformDefinition> = {
  'github-vscode': {
    id: 'github-vscode',
    displayName: 'GitHub Copilot for VS Code',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['github-vscode'],
    resolveRoot: (scope, context) => scope === 'global'
      ? getVSCodeGlobalPromptsDir()
      : projectRoot(context, '.github'),
    resolveSkillsRoot: (scope, context) => scope === 'global'
      ? getCopilotGlobalSkillsDir()
      : projectSkillsRoot(projectRoot(context, '.github')),
    skipOutputTypes: ['inject-guidelines-command'],
    postProcess: 'flatten-vscode-prompts'
  },
  'github-jetbrains': {
    id: 'github-jetbrains',
    displayName: 'GitHub Copilot for JetBrains',
    supportedScopes: ['project'],
    config: PLATFORM_CONFIGS['github-jetbrains'],
    resolveRoot: (_scope, context) => projectRoot(context, '.github'),
    resolveSkillsRoot: (_scope, context) => projectSkillsRoot(projectRoot(context, '.github'))
  },
  'github-copilot-cli': {
    id: 'github-copilot-cli',
    displayName: 'GitHub Copilot CLI',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['github-copilot-cli'],
    resolveRoot: (scope, context) => scope === 'global'
      ? getGitHubCopilotCliGlobalConfigDir()
      : projectRoot(context, '.github'),
    resolveSkillsRoot: (scope, context) => scope === 'global'
      ? getGitHubCopilotCliUserSkillsDir()
      : projectSkillsRoot(projectRoot(context, '.github'))
  },
  'gemini-cli': {
    id: 'gemini-cli',
    displayName: 'Gemini CLI',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['gemini-cli'],
    resolveRoot: (scope, context) => scope === 'global'
      ? globalRoot(context, '.gemini')
      : projectRoot(context, '.gemini'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? globalRoot(context, '.gemini') : projectRoot(context, '.gemini'),
      'skills'
    )
  },
  'qwen-code': {
    id: 'qwen-code',
    displayName: 'Qwen Code',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['qwen-code'],
    resolveRoot: (scope, context) => scope === 'global'
      ? globalRoot(context, '.qwen')
      : projectRoot(context, '.qwen'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? globalRoot(context, '.qwen') : projectRoot(context, '.qwen'),
      'skills'
    )
  },
  'qoder': {
    id: 'qoder',
    displayName: 'Qoder CLI / IDE',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['qoder'],
    resolveRoot: (scope, context) => scope === 'global'
      ? getQoderGlobalConfigDir()
      : projectRoot(context, '.qoder'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? getQoderGlobalConfigDir() : projectRoot(context, '.qoder'),
      'skills'
    )
  },
  'opencode': {
    id: 'opencode',
    displayName: 'OpenCode',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['opencode'],
    resolveRoot: (scope, context) => scope === 'global'
      ? getOpenCodeGlobalConfigDir()
      : projectRoot(context, '.opencode'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? getOpenCodeGlobalConfigDir() : projectRoot(context, '.opencode'),
      'skills'
    )
  },
  'cline': {
    id: 'cline',
    displayName: 'Cline',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['cline'],
    resolveRoot: (scope, context) => scope === 'global'
      ? globalRoot(context, '.cline')
      : projectRoot(context, '.cline'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? globalRoot(context, '.cline') : projectRoot(context, '.cline'),
      'skills'
    )
  },
  'antigravity': {
    id: 'antigravity',
    displayName: 'Google Antigravity IDE',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['antigravity'],
    resolveRoot: (scope, context) => scope === 'global'
      ? globalRoot(context, '.gemini', 'config')
      : projectRoot(context, '.agents'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? globalRoot(context, '.gemini', 'config') : projectRoot(context, '.agents'),
      'skills'
    )
  },
  'antigravity-cli': {
    id: 'antigravity-cli',
    displayName: 'Google Antigravity CLI (AGY)',
    supportedScopes: ['global', 'project'],
    config: PLATFORM_CONFIGS['antigravity-cli'],
    resolveRoot: (scope, context) => scope === 'global'
      ? globalRoot(context, '.gemini', 'antigravity-cli')
      : projectRoot(context, '.agents'),
    resolveSkillsRoot: (scope, context) => path.join(
      scope === 'global' ? globalRoot(context, '.gemini', 'antigravity-cli') : projectRoot(context, '.agents'),
      'skills'
    )
  },
  'codex': {
    id: 'codex',
    displayName: 'OpenAI Codex',
    supportedScopes: ['project'],
    config: PLATFORM_CONFIGS['codex'],
    resolveRoot: (_scope, context) => projectRoot(context, '.codex'),
    resolveSkillsRoot: (_scope, context) => projectSkillsRoot(projectRoot(context, '.codex')),
    postProcess: 'remove-codex-legacy-commands'
  },
  'claudecode': {
    id: 'claudecode',
    displayName: 'Claude Code',
    supportedScopes: ['project'],
    config: PLATFORM_CONFIGS['claudecode'],
    resolveRoot: (_scope, context) => projectRoot(context, '.claude'),
    resolveSkillsRoot: (_scope, context) => projectSkillsRoot(projectRoot(context, '.claude'))
  }
};

export function getPlatformDefinition(platformId: string): PlatformDefinition | undefined {
  return PLATFORM_DEFINITIONS[platformId];
}

export function getPlatformDefinitions(): PlatformDefinition[] {
  return Object.values(PLATFORM_DEFINITIONS);
}

export function getGlobalCapablePlatforms(): PlatformDefinition[] {
  return getPlatformDefinitions().filter(definition => definition.supportedScopes.includes('global'));
}

export function resolvePlatformScope(definition: PlatformDefinition, requested: InjectionScope): InjectionScope {
  return definition.supportedScopes.includes(requested) ? requested : 'project';
}
