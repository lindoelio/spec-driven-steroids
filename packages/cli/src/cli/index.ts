#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { resolveTemplateSource } from './template-source.js';
import {
  OpenCodeInjectionScope,
  getOpenCodeGlobalConfigPath,
  getOpenCodeGlobalConfigDir
} from './opencode-scope.js';
import {
  GitHubCopilotInjectionScope,
  getVSCodeUserProfileMcpPath,
  getVSCodeGlobalPromptsDir,
  getCopilotGlobalSkillsDir
} from './github-copilot-scope.js';
import {
  GitHubCopilotCliInjectionScope,
  getGitHubCopilotCliGlobalMcpPath,
  getGitHubCopilotCliUserSkillsDir
} from './github-copilot-cli-scope.js';
import {
  GeminiCliInjectionScope,
  getGeminiCliGlobalMcpPath,
  getGeminiCliUserSkillsDir,
  getGeminiCliAgentsAliasDir,
  getGeminiCliUserAgentsDir,
  getGeminiCliUserCommandsDir,
  getGeminiCliProjectMcpPath
} from './gemini-cli-scope.js';
import {
  QwenCodeInjectionScope,
  getQwenCodeGlobalMcpPath,
  getQwenCodeUserSkillsDir
} from './qwen-code-scope.js';
import { transformTemplates } from './transformation-pipeline.js';
import { createValidateCommand } from '../core/validate/index.js';

/**
 * Platforms that support global injection scope.
 */
const GLOBAL_CAPABLE_PLATFORMS = ['github-vscode', 'github-copilot-cli', 'gemini-cli', 'qwen-code', 'opencode'] as const;
type GlobalCapablePlatform = typeof GLOBAL_CAPABLE_PLATFORMS[number];

/**
 * Unified scope enum for all global-capable platforms.
 */
enum UnifiedInjectionScope {
  PROJECT = 'project',
  GLOBAL = 'global'
}

/**
 * Scope selection prompt options for unified scope selection.
 */
const UNIFIED_SCOPE_PROMPT_OPTIONS = [
  { name: 'Global (recommended - available across all projects)', value: UnifiedInjectionScope.GLOBAL },
  { name: 'Project-level (isolated to this project)', value: UnifiedInjectionScope.PROJECT }
];

const DEFAULT_UNIFIED_SCOPE = UnifiedInjectionScope.GLOBAL;

const STEROIDS_SERVER_NAME = 'spec-driven-steroids';

const STEROIDS_FILES = {
  agents: ['spec-driven.agent.md'],
  commands: ['spec-driven.command.md', 'spec-driven.md', 'inject-guidelines.md']
} as const;

const STEROIDS_SKILL_DIRS = [
  'spec-driven-technical-designer',
  'spec-driven-task-implementer',
  'spec-driven-requirements-writer',
  'spec-driven-task-decomposer',
  'long-running-work-planning',
  'project-guidelines-writer',
  'agent-work-auditor',
  'code-review-hardening',
  'contextual-stewardship',
  'quality-grading',
  'universal-live-check'
] as const;

interface McpConfig {
  mcpServers?: Record<string, McpServerEntry>;
}

interface CopilotMcpConfig {
  servers?: Record<string, McpServerEntry>;
  mcpServers?: Record<string, McpServerEntry>;
}

interface McpServerEntry {
  command: string;
  args: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../package.json');

function getCliVersion(): string {
  try {
    const pkg = fs.readJsonSync(packageJsonPath) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('spec-driven-steroids')
  .alias('sds')
  .description('Inject Spec-Driven standards into your repository')
  .version(getCliVersion());

program.addCommand(createValidateCommand());

program
  .command('inject')
  .description('Inject platform-specific Spec-Driven configs')
  .action(async () => {
    console.log(chalk.bold.cyan('\n💪 Injecting steroids...\n'));

    // First prompt: platform selection
    const { platforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select platforms to support:',
        choices: [
          { name: 'GitHub Copilot for VS Code', value: 'github-vscode' },
          { name: 'GitHub Copilot for JetBrains', value: 'github-jetbrains' },
          { name: 'GitHub Copilot CLI', value: 'github-copilot-cli' },
          { name: 'Gemini CLI', value: 'gemini-cli' },
          { name: 'Qwen Code', value: 'qwen-code' },
          { name: 'Google Antigravity', value: 'antigravity' },
          { name: 'OpenCode', value: 'opencode' },
          { name: 'OpenAI Codex', value: 'codex' },
          { name: 'Claude Code', value: 'claudecode' }
        ],
        validate: (input: string[]) => input.length > 0 || 'Select at least one platform.'
      }
    ]);

    // Determine which global-capable platforms are selected
    const selectedGlobalPlatforms = platforms.filter((p: string) => 
      GLOBAL_CAPABLE_PLATFORMS.includes(p as GlobalCapablePlatform)
    ) as GlobalCapablePlatform[];
    
    // Second prompt: unified scope selection (if any global-capable platform is selected)
    let unifiedScope = DEFAULT_UNIFIED_SCOPE;
    if (selectedGlobalPlatforms.length > 0) {
      const platformNames = selectedGlobalPlatforms.map(p => {
        switch (p) {
          case 'github-vscode': return 'GitHub Copilot for VS Code';
          case 'github-copilot-cli': return 'GitHub Copilot CLI';
          case 'gemini-cli': return 'Gemini CLI';
          case 'qwen-code': return 'Qwen Code';
          case 'opencode': return 'OpenCode';
          default: return p;
        }
      }).join(', ');
      
      const { scope } = await inquirer.prompt([
        {
          type: 'list',
          name: 'scope',
          message: `Injection scope for ${platformNames}:`,
          choices: UNIFIED_SCOPE_PROMPT_OPTIONS,
          default: DEFAULT_UNIFIED_SCOPE
        }
      ]);
      unifiedScope = scope as UnifiedInjectionScope;
    }

    // Derive individual platform scopes from unified scope
    const openCodeScope = unifiedScope === UnifiedInjectionScope.GLOBAL
      ? OpenCodeInjectionScope.GLOBAL
      : OpenCodeInjectionScope.PROJECT;
    const githubScope = unifiedScope === UnifiedInjectionScope.GLOBAL
      ? GitHubCopilotInjectionScope.GLOBAL
      : GitHubCopilotInjectionScope.PROJECT;
    const githubCopilotCliScope = unifiedScope === UnifiedInjectionScope.GLOBAL
      ? GitHubCopilotCliInjectionScope.USER
      : GitHubCopilotCliInjectionScope.PROJECT;
    const geminiCliScope = unifiedScope === UnifiedInjectionScope.GLOBAL
      ? GeminiCliInjectionScope.USER
      : GeminiCliInjectionScope.PROJECT;
    const qwenCodeScope = unifiedScope === UnifiedInjectionScope.GLOBAL
      ? QwenCodeInjectionScope.USER
      : QwenCodeInjectionScope.PROJECT;

    const targetDir = process.cwd();
    const bundledTemplatesDir = path.resolve(__dirname, '../../templates');
    const templateSource = await resolveTemplateSource({
      bundledTemplatesDir
    });
    const standardsDir = templateSource.rootDir;
    const universalSkillsDir = path.join(standardsDir, 'universal/skills');

    if (templateSource.source === 'remote') {
      console.log(chalk.green(`Using remote templates (${templateSource.version}).`));
    } else {
      console.log(chalk.yellow('Using bundled templates.'));
      if (templateSource.fallbackReason) {
        console.log(chalk.yellow(`Remote template retrieval failed, so inject fell back to bundled templates: ${templateSource.fallbackReason}`));
      }
    }

    for (const platform of platforms) {
      console.log(chalk.yellow(`\nConfiguring ${platform}...`));

      try {
        let platformDest = '';
        let skillsSubDir = 'skills';
        let transformDestDir = '';

        if (platform === 'github-vscode') {
          if (githubScope === GitHubCopilotInjectionScope.GLOBAL) {
            // Global injection: configure MCP at user profile level
            await configureVSCodeMcpGlobal();
            
            // Transform universal prompts to global VS Code prompts directory
            const globalPromptsDir = getVSCodeGlobalPromptsDir();
            transformDestDir = globalPromptsDir;
            
            // Copy universal skills to global Copilot skills directory
            const globalSkillsDir = getCopilotGlobalSkillsDir();
            await fs.ensureDir(globalSkillsDir);
            await fs.copy(universalSkillsDir, globalSkillsDir, { overwrite: true });
            
            console.log(chalk.green(`✅ GitHub Copilot for VS Code configured globally`));
            console.log(chalk.cyan(`   MCP: ${getVSCodeUserProfileMcpPath()}`));
            console.log(chalk.cyan(`   Prompts: ${globalPromptsDir}/`));
            console.log(chalk.cyan(`   Skills: ${globalSkillsDir}/`));
          } else {
            // Project-level injection
            await configureCopilotMcp(targetDir);
            platformDest = path.join(targetDir, '.github');
            transformDestDir = platformDest;
          }
        }

        if (platform === 'github-jetbrains') {
          // Project-level injection: configure MCP and project .github/
          await configureJetBrainsMcp();
          platformDest = path.join(targetDir, '.github');
          transformDestDir = platformDest;
        }

        if (platform === 'antigravity') {
          // Project-level injection only: configure MCP and copy templates
          await configureAntigravityMcp();
          platformDest = path.join(targetDir, '.agents');
          transformDestDir = platformDest;
        }

        if (platform === 'opencode') {
          if (openCodeScope === OpenCodeInjectionScope.GLOBAL) {
            // Global injection: configure MCP and copy all artifacts to global directory
            await configureOpenCodeMcpGlobal();
            
            // Transform universal prompts to global opencode directory
            const globalOpencodeDir = getOpenCodeGlobalConfigDir();
            transformDestDir = globalOpencodeDir;
            
            // Copy universal skills to global skills directory
            const globalSkillsDir = path.join(globalOpencodeDir, 'skills');
            await fs.ensureDir(globalSkillsDir);
            await fs.copy(universalSkillsDir, globalSkillsDir, { overwrite: true });
            
            console.log(chalk.green(`✅ OpenCode configured globally at ${globalOpencodeDir}`));
          } else {
            // Project-level injection: configure MCP and copy templates
            await configureOpenCodeMcp(targetDir);
            platformDest = path.join(targetDir, '.opencode');
            transformDestDir = platformDest;

            // Specifically for OpenCode, we need to update opencode.json
            await updateOpenCodeConfig(targetDir);
          }
        }

        if (platform === 'codex') {
          await configureCodexMcp(targetDir);
          platformDest = path.join(targetDir, '.codex');
          transformDestDir = platformDest;
        }

        if(platform === 'claudecode') {
          await configureClaudeCodeMcp(targetDir);
          platformDest = path.join(targetDir, '.claude');
          transformDestDir = platformDest;
        }

        if (platform === 'github-copilot-cli') {
          if (githubCopilotCliScope === GitHubCopilotCliInjectionScope.USER) {
            // User-level injection
            await configureGitHubCopilotCliMcp(githubCopilotCliScope, targetDir)

            // For github-copilot-cli, agentDirectory is 'agents', skills go to ~/.copilot/skills/
            // The MCP config goes to ~/.config/github-copilot/
            const globalConfigDir = path.join(os.homedir(), '.config', 'github-copilot')
            platformDest = globalConfigDir
            transformDestDir = globalConfigDir
            skillsSubDir = 'skills'

            console.log(chalk.green(`✅ GitHub Copilot CLI configured at user level`))
            console.log(chalk.cyan(`   MCP: ${getGitHubCopilotCliGlobalMcpPath()}`))
          } else {
            // Project-level injection
            await configureGitHubCopilotCliMcp(githubCopilotCliScope, targetDir)
            platformDest = path.join(targetDir, '.github')
            transformDestDir = platformDest
          }
        }

        if (platform === 'gemini-cli') {
          if (geminiCliScope === GeminiCliInjectionScope.USER) {
            // User-level injection
            await configureGeminiCliMcp(geminiCliScope, targetDir)

            // For gemini-cli: agents go to ~/.gemini/agents/, commands to ~/.gemini/commands/, skills to ~/.gemini/skills/
            platformDest = path.join(os.homedir(), '.gemini')
            transformDestDir = platformDest

            console.log(chalk.green(`✅ Gemini CLI configured at user level`))
            console.log(chalk.cyan(`   Agents: ${getGeminiCliUserAgentsDir()}/`))
            console.log(chalk.cyan(`   Commands: ${getGeminiCliUserCommandsDir()}/`))
            console.log(chalk.cyan(`   Skills: ${getGeminiCliUserSkillsDir()}/`))
          } else {
            // Project-level injection
            await configureGeminiCliMcp(geminiCliScope, targetDir)
            platformDest = path.join(targetDir, '.gemini')
            transformDestDir = platformDest
          }
        }

        if (platform === 'qwen-code') {
          if (qwenCodeScope === QwenCodeInjectionScope.USER) {
            // User-level injection
            await configureQwenCodeMcp(qwenCodeScope, targetDir)

            // For qwen-code, agentDirectory is 'skills', skills go to ~/.qwen/skills/
            platformDest = path.join(os.homedir(), '.qwen')
            transformDestDir = platformDest

            console.log(chalk.green(`✅ Qwen Code configured at user level`))
            console.log(chalk.cyan(`   Skills: ${getQwenCodeUserSkillsDir()}/`))
          } else {
            // Project-level injection
            await configureQwenCodeMcp(qwenCodeScope, targetDir)
            platformDest = path.join(targetDir, '.qwen')
            transformDestDir = platformDest
          }
        }

        // Transform universal prompts for this platform
        if (transformDestDir) {
          // For VS Code global, skip inject-guidelines prompt (not supported as slash command at user level)
          const skipOutputTypes = (platform === 'github-vscode' && githubScope === GitHubCopilotInjectionScope.GLOBAL)
            ? ['inject-guidelines-command']
            : undefined;

          const transformResults = await transformTemplates(
            [platform],
            standardsDir,
            () => transformDestDir,
            { skipOutputTypes }
          );
          
          // Log transformation results
          for (const result of transformResults) {
            if (result.success) {
              console.log(chalk.green(`  Transformed: ${result.sourcePath} -> ${result.outputPath}`));
              if (!result.bodyPreserved) {
                console.log(chalk.yellow(`  Warning: transformed prompt body preservation could not be verified for ${result.outputPath}`));
              }
            } else {
              console.error(chalk.red(`  Transform failed: ${result.sourcePath} - ${result.error}`));
            }
          }

          // For VS Code global, flatten the directory structure
          // Move files from agents/ and prompts/ subdirectories to the root prompts directory
          if (platform === 'github-vscode' && githubScope === GitHubCopilotInjectionScope.GLOBAL) {
            await flattenVSCodeGlobalPrompts(transformDestDir);
          }
        }

        // Copy universal skills to the platform's skills directory
        if (platformDest) {
          const destSkillsDir = path.join(platformDest, skillsSubDir);
          await fs.ensureDir(destSkillsDir);
          await fs.copy(universalSkillsDir, destSkillsDir, { overwrite: true });
          console.log(chalk.green(`✅ ${platform} config and universal skills injected.`));
        }

        // Sync alias directory for Gemini CLI after skills are copied to native location
        // This ensures ~/.gemini/skills/ is the authoritative source and ~/.agents/skills/ is synced from it
        if (platform === 'gemini-cli' && geminiCliScope === GeminiCliInjectionScope.USER) {
          const nativeSkillsDir = getGeminiCliUserSkillsDir();
          const aliasDir = getGeminiCliAgentsAliasDir();
          await fs.ensureDir(aliasDir);
          await fs.copy(nativeSkillsDir, aliasDir, { overwrite: true });
        }

      } catch (err) {
        console.error(chalk.red(`❌ Failed to inject ${platform} config:`, err));
      }
    }

    console.log(chalk.bold.cyan('\n🚀 Injection Complete!'));
  });

program
  .command('clean')
  .description('Remove globally injected Spec-Driven Steroids')
  .option('--global', 'Clean global steroids from all platforms (default)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async ({ yes }) => {
    console.log(chalk.bold.cyan('\n🧹 Cleaning global steroids...\n'));

    const preview = buildCleanPreview();
    console.log(preview);

    if (!yes) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with cleaning?',
          default: false
        }
      ]);
      if (!confirmed) {
        console.log(chalk.yellow('Aborted.'));
        return;
      }
    }

    console.log(chalk.cyan('\n'));

    const results = await Promise.all([
      removeVSCodeGlobalSteroids(),
      removeGitHubCopilotCliSteroids(),
      removeGeminiCliSteroids(),
      removeQwenCodeSteroids(),
      removeOpenCodeGlobalSteroids()
    ]);

    const allCleaned = results.every(r => r);
    if (allCleaned) {
      console.log(chalk.bold.green('\n✅ All global steroids cleaned successfully.'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️ Some platforms could not be fully cleaned.'));
    }
  });

function isCliEntrypoint(): boolean {
  if (process.env.VITEST) return false;

  const entry = process.argv[1];
  if (!entry) return false;

  try {
    if (fs.realpathSync(path.resolve(entry)) === fs.realpathSync(__filename)) {
      return true;
    }
  } catch {
    // Fall through to path heuristics used by package-manager wrappers.
  }

  const normalizedEntry = entry.replace(/\\/g, '/');
  return normalizedEntry.includes('spec-driven-steroids') && (normalizedEntry.endsWith('/dist/cli/index.js') || normalizedEntry.endsWith('/dist/index.js'));
}

if (isCliEntrypoint()) {
  program.parseAsync().catch((error) => {
    console.error(chalk.red('Fatal CLI error:'), error);
    process.exit(1);
  });
}

export default program;

async function configureCopilotMcp(targetDir: string) {
  try {
    const vscodeDir = path.join(targetDir, '.vscode');
    await fs.ensureDir(vscodeDir);
    const mcpConfigPath = path.join(vscodeDir, 'mcp.json');

    let config: CopilotMcpConfig = { servers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as CopilotMcpConfig;
        if (!config.servers) config.servers = {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing .vscode/mcp.json.'));
      }
    }

    const legacyServers = config.mcpServers ?? {};
    if (!config.servers) config.servers = {};
    for (const [serverName, serverConfig] of Object.entries(legacyServers)) {
      if (!config.servers[serverName]) {
        config.servers[serverName] = serverConfig;
      }
    }

    delete config.mcpServers;

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure GitHub Copilot MCP:'), error);
  }
}

function getAntigravityMcpPath(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
}

async function configureAntigravityMcp(): Promise<boolean> {
  try {
    const mcpConfigPath = getAntigravityMcpPath();
    const configDir = path.dirname(mcpConfigPath);

    await fs.ensureDir(configDir);

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as McpConfig;
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing Antigravity MCP config.'));
      }
    }

    if (!config.mcpServers) config.mcpServers = {};

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green(`✅ Antigravity MCP configured at ${mcpConfigPath}`));
    return true;
  } catch (error) {
    console.error(chalk.red('Failed to configure Antigravity MCP:'), error);
    throw error;
  }
}

async function configureOpenCodeMcp(targetDir: string) {
  try {
    const configPath = path.join(targetDir, 'opencode.json');

    let config: Record<string, unknown> = {};
    if (await fs.pathExists(configPath)) {
      try {
        const raw = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(raw.replace(/^\uFEFF/, ''));
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing opencode.json.'));
        console.warn(chalk.yellow('Preserving existing file. MCP entry will not be added.'));
        return;
      }
    }

    const mcp = (config.mcp ?? {}) as Record<string, unknown>;
    config.mcp = mcp;

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure OpenCode MCP:'), error);
  }
}

async function configureOpenCodeMcpGlobal(): Promise<string> {
  const mcpConfigPath = getOpenCodeGlobalConfigPath();
  const configDir = path.dirname(mcpConfigPath);

  await fs.ensureDir(configDir);

  let config: Record<string, unknown> = {};
  if (await fs.pathExists(mcpConfigPath)) {
    try {
      const raw = await fs.readFile(mcpConfigPath, 'utf-8');
      config = JSON.parse(raw.replace(/^\uFEFF/, ''));
    } catch (e) {
      throw new Error(
        `Could not parse existing global OpenCode config at ${mcpConfigPath}. ` +
        'Please fix or remove the file and try again.'
      );
    }
  }

  const mcp = (config.mcp ?? {}) as Record<string, unknown>;
  config.mcp = mcp;

  await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  return mcpConfigPath;
}

async function updateOpenCodeConfig(targetDir: string) {
  const configPath = path.join(targetDir, 'opencode.json');
  if (!await fs.pathExists(configPath)) return;

  const config = await fs.readJson(configPath);

  // Add $schema if not present for validation/autocomplete support
  if (!config.$schema) {
    config.$schema = 'https://opencode.ai/config.json';
  }

  // Skills are auto-discovered by OpenCode, so we don't need to add them to the config

  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log(chalk.green('✅ opencode.json updated with schema.'));
}

function getJetBrainsMcpPath(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'github-copilot', 'intellij', 'mcp.json');
  }
  return path.join(os.homedir(), '.config', 'github-copilot', 'intellij', 'mcp.json');
}

async function configureJetBrainsMcp() {
  try {
    const mcpConfigPath = getJetBrainsMcpPath();
    const configDir = path.dirname(mcpConfigPath);

    await fs.ensureDir(configDir);

    let config: CopilotMcpConfig = { servers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as CopilotMcpConfig;
        if (!config.servers) config.servers = {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing JetBrains MCP config.'));
      }
    }

    const legacyServers = config.mcpServers ?? {};
    if (!config.servers) config.servers = {};
    for (const [serverName, serverConfig] of Object.entries(legacyServers)) {
      if (!config.servers[serverName]) {
        config.servers[serverName] = serverConfig;
      }
    }

    delete config.mcpServers;

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green(`✅ JetBrains MCP configured at ${mcpConfigPath}`));
  } catch (error) {
    console.error(chalk.red('Failed to configure JetBrains MCP:'), error);
  }
}

async function configureVSCodeMcpGlobal(): Promise<string> {
  const mcpConfigPath = getVSCodeUserProfileMcpPath();
  const configDir = path.dirname(mcpConfigPath);

  await fs.ensureDir(configDir);

  let config: CopilotMcpConfig = { servers: {} };
  if (await fs.pathExists(mcpConfigPath)) {
    try {
      config = await fs.readJson(mcpConfigPath) as CopilotMcpConfig;
      if (!config.servers) config.servers = {};
    } catch (e) {
      console.warn(chalk.yellow('Warning: Could not parse existing VS Code user profile MCP config.'));
    }
  }

  const legacyServers = config.mcpServers ?? {};
  if (!config.servers) config.servers = {};
  for (const [serverName, serverConfig] of Object.entries(legacyServers)) {
    if (!config.servers[serverName]) {
      config.servers[serverName] = serverConfig;
    }
  }

  delete config.mcpServers;

  await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  console.log(chalk.green(`✅ VS Code User Profile MCP configured at ${mcpConfigPath}`));
  return mcpConfigPath;
}

async function configureCodexMcp(targetDir: string) {
  try {
    const codexDir = path.join(targetDir, '.codex');
    await fs.ensureDir(codexDir);
    const mcpConfigPath = path.join(codexDir, 'config.toml');

    if (!await fs.pathExists(mcpConfigPath)) {
      await fs.writeFile(mcpConfigPath, '', 'utf-8');
    }

    console.log(chalk.green('✅ Created .codex/config.toml in project root.'));
  } catch (error) {
    console.error(chalk.red('Failed to configure Codex MCP:'), error);
  }
}

async function configureClaudeCodeMcp(targetDir: string) {
  try {
    const mcpConfigPath = path.join(targetDir, '.mcp.json');

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const existing = await fs.readJson(mcpConfigPath) as McpConfig;
        config.mcpServers = existing.mcpServers ?? {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing .mcp.json.'));
      }
    }

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green('✅ Created .mcp.json in project root.'));
  } catch (error) {
    console.error(chalk.red('Failed to configure Claude Code MCP:'), error);
  }
}

async function configureGitHubCopilotCliMcp(scope: GitHubCopilotCliInjectionScope, targetDir: string) {
  try {
    let mcpConfigPath: string
    if (scope === GitHubCopilotCliInjectionScope.USER) {
      mcpConfigPath = getGitHubCopilotCliGlobalMcpPath()
    } else {
      mcpConfigPath = path.join(targetDir, '.github', 'mcp.json')
    }

    const configDir = path.dirname(mcpConfigPath)
    await fs.ensureDir(configDir)

    let config: CopilotMcpConfig = { servers: {} }
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as CopilotMcpConfig
        if (!config.servers) config.servers = {}
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing GitHub Copilot CLI MCP config.'))
      }
    }

    const legacyServers = config.mcpServers ?? {}
    if (!config.servers) config.servers = {}
    for (const [serverName, serverConfig] of Object.entries(legacyServers)) {
      if (!config.servers[serverName]) {
        config.servers[serverName] = serverConfig
      }
    }

    delete config.mcpServers

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 })
    console.log(chalk.green(`✅ GitHub Copilot CLI MCP configured at ${mcpConfigPath}`))
  } catch (error) {
    console.error(chalk.red('Failed to configure GitHub Copilot CLI MCP:'), error)
  }
}

async function configureGeminiCliMcp(scope: GeminiCliInjectionScope, targetDir: string) {
  try {
    let mcpConfigPath: string
    if (scope === GeminiCliInjectionScope.USER) {
      mcpConfigPath = getGeminiCliGlobalMcpPath()
    } else {
      mcpConfigPath = getGeminiCliProjectMcpPath(targetDir)
    }

    const configDir = path.dirname(mcpConfigPath)
    await fs.ensureDir(configDir)

    let config: McpConfig = { mcpServers: {} }
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as McpConfig
        if (!config.mcpServers) config.mcpServers = {}
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing Gemini CLI MCP config.'))
      }
    }

    if (!config.mcpServers) config.mcpServers = {}

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 })
    console.log(chalk.green(`✅ Gemini CLI MCP configured at ${mcpConfigPath}`))
  } catch (error) {
    console.error(chalk.red('Failed to configure Gemini CLI MCP:'), error)
  }
}

async function configureQwenCodeMcp(scope: QwenCodeInjectionScope, targetDir: string) {
  try {
    let mcpConfigPath: string
    if (scope === QwenCodeInjectionScope.USER) {
      mcpConfigPath = getQwenCodeGlobalMcpPath()
    } else {
      mcpConfigPath = path.join(targetDir, '.qwen', 'mcp_config.json')
    }

    const configDir = path.dirname(mcpConfigPath)
    await fs.ensureDir(configDir)

    let config: McpConfig = { mcpServers: {} }
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as McpConfig
        if (!config.mcpServers) config.mcpServers = {}
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing Qwen Code MCP config.'))
      }
    }

    if (!config.mcpServers) config.mcpServers = {}

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 })
    console.log(chalk.green(`✅ Qwen Code MCP configured at ${mcpConfigPath}`))
  } catch (error) {
    console.error(chalk.red('Failed to configure Qwen Code MCP:'), error)
  }
}

function buildCleanPreview(): string {
  const vscodeMcpPath = getVSCodeUserProfileMcpPath();
  const vscodePromptsDir = getVSCodeGlobalPromptsDir();
  const vscodeSkillsDir = getCopilotGlobalSkillsDir();
  const opencodeDir = getOpenCodeGlobalConfigDir();
  const githubCopilotCliMcpPath = getGitHubCopilotCliGlobalMcpPath();
  const githubCopilotCliSkillsDir = getGitHubCopilotCliUserSkillsDir();
  const geminiCliMcpPath = getGeminiCliGlobalMcpPath();
  const geminiCliSkillsDir = getGeminiCliUserSkillsDir();
  const qwenCodeMcpPath = getQwenCodeGlobalMcpPath();
  const qwenCodeSkillsDir = getQwenCodeUserSkillsDir();

  const formatDir = (d: string) => d.replace(os.homedir(), '~');

  const lines = [
    chalk.bold.cyan('🔍 Preview of --global clean:\n'),
    `  ${chalk.bold('GitHub Copilot for VS Code')}:`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME} (${formatDir(vscodeMcpPath)})`,
    `    • Prompts: ${formatDir(vscodePromptsDir)}/`,
    `    • Skills: ${formatDir(vscodeSkillsDir)}/`,
    '',
    `  ${chalk.bold('GitHub Copilot CLI')}:`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME} (${formatDir(githubCopilotCliMcpPath)})`,
    `    • Skills: ${formatDir(githubCopilotCliSkillsDir)}/`,
    '',
    `  ${chalk.bold('Gemini CLI')}:`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME} (${formatDir(geminiCliMcpPath)})`,
    `    • Skills: ${formatDir(geminiCliSkillsDir)}/`,
    '',
    `  ${chalk.bold('Qwen Code')}:`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME} (${formatDir(qwenCodeMcpPath)})`,
    `    • Skills: ${formatDir(qwenCodeSkillsDir)}/`,
    '',
    `  ${chalk.bold('OpenCode')} (${formatDir(opencodeDir)}):`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME}`,
    `    • agents/${STEROIDS_FILES.agents.join(', ')}`,
    `    • commands/${STEROIDS_FILES.commands.join(', ')}`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    ''
  ];

  return lines.join('\n');
}

async function removeVSCodeGlobalSteroids(): Promise<boolean> {
  try {
    const mcpPath = getVSCodeUserProfileMcpPath();
    await removeMcpEntry(mcpPath, ['servers', 'mcpServers']);
    await removeVSCodeGlobalPrompts();
    await removeVSCodeGlobalSkills();
    console.log(chalk.green('  ✅ GitHub Copilot for VS Code cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ VS Code: ${err}`));
    return false;
  }
}

async function removeVSCodeGlobalPrompts(): Promise<void> {
  const promptsDir = getVSCodeGlobalPromptsDir();
  const filesToRemove = [
    path.join(promptsDir, 'spec-driven.agent.md'),
    path.join(promptsDir, 'inject-guidelines.md'),
    path.join(promptsDir, 'spec-driven.prompt.md')
  ];
  for (const file of filesToRemove) {
    if (await fs.pathExists(file)) {
      await fs.remove(file);
    }
  }
  // Also clean up subdirectories if they exist
  const subDirs = ['agents', 'prompts'];
  for (const subDir of subDirs) {
    const subDirPath = path.join(promptsDir, subDir);
    if (await fs.pathExists(subDirPath)) {
      await fs.remove(subDirPath);
    }
  }
}

async function removeVSCodeGlobalSkills(): Promise<void> {
  const skillsDir = getCopilotGlobalSkillsDir();
  if (!await fs.pathExists(skillsDir)) {
    return;
  }
  for (const skill of STEROIDS_SKILL_DIRS) {
    const skillPath = path.join(skillsDir, skill);
    if (await fs.pathExists(skillPath)) {
      await fs.remove(skillPath);
    }
  }
}

async function flattenVSCodeGlobalPrompts(promptsDir: string): Promise<void> {
  const subDirs = ['agents', 'prompts'];
  for (const subDir of subDirs) {
    const subDirPath = path.join(promptsDir, subDir);
    if (!await fs.pathExists(subDirPath)) {
      continue;
    }
    const files = await fs.readdir(subDirPath);
    for (const file of files) {
      const src = path.join(subDirPath, file);
      const dest = path.join(promptsDir, file);
      await fs.move(src, dest, { overwrite: true });
    }
    const remaining = await fs.readdir(subDirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(subDirPath);
    }
  }
}

async function removeOpenCodeGlobalSteroids(): Promise<boolean> {
  try {
    const mcpPath = getOpenCodeGlobalConfigPath();
    await removeMcpEntry(mcpPath, ['mcp']);
    await removeSteroidsFiles(getOpenCodeGlobalConfigDir());
    await removeSteroidsSkillDirs(getOpenCodeGlobalConfigDir());
    console.log(chalk.green('  ✅ OpenCode cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ OpenCode: ${err}`));
    return false;
  }
}

async function removeGitHubCopilotCliSteroids(): Promise<boolean> {
  try {
    const mcpPath = getGitHubCopilotCliGlobalMcpPath()
    await removeMcpEntry(mcpPath, ['servers', 'mcpServers'])
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.config', 'github-copilot'))
    console.log(chalk.green('  ✅ GitHub Copilot CLI cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ GitHub Copilot CLI: ${err}`));
    return false;
  }
}

async function removeGeminiCliSteroids(): Promise<boolean> {
  try {
    const mcpPath = getGeminiCliGlobalMcpPath()
    await removeMcpEntry(mcpPath, ['mcpServers'])
    await removeLegacyGeminiCliMcpEntry()
    await removeGeminiCliGlobalFiles()
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.gemini'))
    // Also clean alias location
    const aliasDir = path.join(os.homedir(), '.agents', 'skills')
    if (await fs.pathExists(aliasDir)) {
      for (const skill of STEROIDS_SKILL_DIRS) {
        const skillPath = path.join(aliasDir, skill)
        if (await fs.pathExists(skillPath)) {
          await fs.remove(skillPath)
        }
      }
    }
    console.log(chalk.green('  ✅ Gemini CLI cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Gemini CLI: ${err}`));
    return false;
  }
}

async function removeLegacyGeminiCliMcpEntry(): Promise<void> {
  await removeMcpEntry(path.join(os.homedir(), '.gemini', 'mcp_config.json'), ['mcpServers'])
}

async function removeGeminiCliGlobalFiles(): Promise<void> {
  const filesToRemove = [
    path.join(os.homedir(), '.gemini', 'agents', 'spec-driven.md'),
    path.join(os.homedir(), '.gemini', 'commands', 'spec-driven.toml'),
    path.join(os.homedir(), '.gemini', 'commands', 'inject-guidelines.toml'),
    path.join(os.homedir(), '.gemini', 'commands', 'spec-driven.md'),
    path.join(os.homedir(), '.gemini', 'commands', 'inject-guidelines.md')
  ];

  for (const file of filesToRemove) {
    if (await fs.pathExists(file)) {
      await fs.remove(file)
    }
  }

  for (const dir of ['agents', 'commands']) {
    const dirPath = path.join(os.homedir(), '.gemini', dir)
    const remaining = await fs.readdir(dirPath).catch(() => [])
    if (remaining.length === 0) {
      await fs.remove(dirPath)
    }
  }
}

async function removeQwenCodeSteroids(): Promise<boolean> {
  try {
    const mcpPath = getQwenCodeGlobalMcpPath()
    await removeMcpEntry(mcpPath, ['mcpServers'])
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.qwen'))
    console.log(chalk.green('  ✅ Qwen Code cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Qwen Code: ${err}`));
    return false;
  }
}

async function removeMcpEntry(mcpPath: string, configKeys: string[]): Promise<void> {
  if (!await fs.pathExists(mcpPath)) {
    return;
  }
  const content = await fs.readFile(mcpPath, 'utf-8');
  const stripped = content.replace(/^\uFEFF/, '');
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(stripped);
  } catch {
    return;
  }
  let changed = false;
  for (const key of configKeys) {
    const servers = config[key] as Record<string, unknown> | undefined;
    if (servers && typeof servers === 'object' && STEROIDS_SERVER_NAME in servers) {
      delete servers[STEROIDS_SERVER_NAME];
      changed = true;
    }
  }
  if (changed) {
    const suffix = stripped.endsWith('\n') ? '\n' : '';
    await fs.writeFile(mcpPath, JSON.stringify(config, null, 2) + suffix, 'utf-8');
  }
}

async function removeSteroidsFiles(baseDir: string): Promise<void> {
  for (const [dir, files] of Object.entries(STEROIDS_FILES)) {
    const dirPath = path.join(baseDir, dir);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    }
    const remaining = await fs.readdir(dirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(dirPath);
    }
  }
}

async function removeSteroidsSkillDirs(baseDir: string): Promise<void> {
  const skillsDir = path.join(baseDir, 'skills');
  if (!await fs.pathExists(skillsDir)) {
    return;
  }
  for (const skill of STEROIDS_SKILL_DIRS) {
    const skillPath = path.join(skillsDir, skill);
    if (await fs.pathExists(skillPath)) {
      await fs.remove(skillPath);
    }
  }
  const remaining = await fs.readdir(skillsDir);
  if (remaining.length === 0) {
    await fs.remove(skillsDir);
  }
}
