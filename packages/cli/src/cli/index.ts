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
import { transformTemplates } from './transformation-pipeline.js';

/**
 * Platforms that support global injection scope.
 */
const GLOBAL_CAPABLE_PLATFORMS = ['github-vscode', 'opencode'] as const;
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

interface McpLaunchConfig {
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
  .description('Inject Spec-Driven standards into your repository')
  .version(getCliVersion());

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
          { name: 'Google Antigravity', value: 'antigravity' },
          { name: 'OpenCode', value: 'opencode' },
          { name: 'OpenAI Codex', value: 'codex' },
          {name: 'Claude Code', value: 'claudecode' }
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

    // Third prompt: sequential-thinking MCP
    const { addSequentialThinkingMcp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addSequentialThinkingMcp',
        message: 'Add sequential-thinking MCP server? (Enables structured reasoning for long-running tasks)',
        default: true
      }
    ]);

    // Fourth prompt: memory MCP
    const { addMemoryMcp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMemoryMcp',
        message: 'Add memory MCP server? (Enables persistent memory across conversations)',
        default: true
      }
    ]);

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
            await configureVSCodeMcpGlobal(addSequentialThinkingMcp, addMemoryMcp);
            
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
            await configureCopilotMcp(targetDir, addSequentialThinkingMcp, addMemoryMcp);
            platformDest = path.join(targetDir, '.github');
            transformDestDir = platformDest;
          }
        }

        if (platform === 'github-jetbrains') {
          // Project-level injection: configure MCP and project .github/
          await configureJetBrainsMcp(addSequentialThinkingMcp, addMemoryMcp);
          platformDest = path.join(targetDir, '.github');
          transformDestDir = platformDest;
        }

        if (platform === 'antigravity') {
          // Project-level injection only: configure MCP and copy templates
          await configureAntigravityMcp(addSequentialThinkingMcp, addMemoryMcp);
          platformDest = path.join(targetDir, '.agents');
          transformDestDir = platformDest;
        }

        if (platform === 'opencode') {
          if (openCodeScope === OpenCodeInjectionScope.GLOBAL) {
            // Global injection: configure MCP and copy all artifacts to global directory
            await configureOpenCodeMcpGlobal(addSequentialThinkingMcp, addMemoryMcp);
            
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
            await configureOpenCodeMcp(targetDir, addSequentialThinkingMcp, addMemoryMcp);
            platformDest = path.join(targetDir, '.opencode');
            transformDestDir = platformDest;

            // Specifically for OpenCode, we need to update opencode.json
            await updateOpenCodeConfig(targetDir);
          }
        }

        if (platform === 'codex') {
          await configureCodexMcp(targetDir, addSequentialThinkingMcp, addMemoryMcp);
          platformDest = path.join(targetDir, '.codex');
          transformDestDir = platformDest;
        }

        if(platform === 'claudecode') {
          await configureClaudeCodeMcp(targetDir, addSequentialThinkingMcp, addMemoryMcp);
          platformDest = path.join(targetDir, '.claude');
          transformDestDir = platformDest;
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

      } catch (err) {
        console.error(chalk.red(`❌ Failed to inject ${platform} config:`, err));
      }
    }

    console.log(chalk.bold.cyan('\n🚀 Injection Complete!'));
  });

program
  .command('clean')
  .description('Remove globally injected Spec-Driven Steroids')
  .requiredOption('--global', 'Clean global steroids from all platforms')
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
      removeOpenCodeGlobalSteroids()
    ]);

    const allCleaned = results.every(r => r);
    if (allCleaned) {
      console.log(chalk.bold.green('\n✅ All global steroids cleaned successfully.'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️ Some platforms could not be fully cleaned.'));
    }
  });

program
  .command('validate')
  .description('Check if Spec-Driven standards are correctly configured')
  .action(async () => {
    const targetDir = process.cwd();
    console.log(chalk.cyan('\n🔍 Validating Spec-Driven setup...\n'));

    const checks = [
      { name: 'GitHub Copilot Config', path: '.github/agents' },
      { name: 'VS Code MCP Config', path: '.vscode/mcp.json' },
      { name: 'Antigravity Config', path: '.agents/workflows' },
      { name: 'OpenCode Config', path: '.opencode/skills' },
      { name: 'Codex Config', path: '.codex/agents' },
      { name: 'Codex Commands', path: '.codex/commands' },
      { name: 'Codex MCP Config', path: '.codex/config.toml' },
      { name: 'ClaudeCode Agents', path: '.claude/agents' },
      { name: 'ClaudeCode Commands', path: '.claude/commands' },
      { name: 'ClaudeCode', path: '.claude/CLAUDE.md' },
      { name: 'ClaudeCode MCP Config', path: '.mcp.json' },
      { name: 'Standard Requirements', path: 'specs' }
    ];

    for (const check of checks) {
      const exists = await fs.pathExists(path.join(targetDir, check.path));
      if (exists) {
        console.log(`${chalk.green('✅')} ${check.name} found.`);
      } else {
        console.log(`${chalk.gray('➖')} ${check.name} not present (optional).`);
      }
    }

    console.log(chalk.yellow('\nTip: Make sure to connect your MCP server to enable structural validation.\n'));
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

async function configureCopilotMcp(targetDir: string, addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false) {
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

    // Add spec-driven-steroids (always)
    const mcpLaunch = resolveMcpLaunchConfig();
    config.servers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      config.servers['sequential-thinking'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
      };
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      config.servers['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      };
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

async function configureAntigravityMcp(addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false): Promise<boolean> {
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

    const mcpLaunch = resolveMcpLaunchConfig();
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      config.mcpServers['sequential-thinking'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
      };
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      config.mcpServers['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      };
    }

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green(`✅ Antigravity MCP configured at ${mcpConfigPath}`));
    return true;
  } catch (error) {
    console.error(chalk.red('Failed to configure Antigravity MCP:'), error);
    throw error;
  }
}

async function configureOpenCodeMcp(targetDir: string, addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false) {
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

    // Add spec-driven-steroids (always) - local MCP server
    const mcpLaunch = resolveMcpLaunchConfig();
    mcp['spec-driven-steroids'] = {
      type: 'local',
      command: [mcpLaunch.command, ...mcpLaunch.args]
    };

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      mcp['sequential-thinking'] = {
        type: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking']
      };
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      mcp['memory'] = {
        type: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory']
      };
    }

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure OpenCode MCP:'), error);
  }
}

async function configureOpenCodeMcpGlobal(addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false): Promise<string> {
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

  // Add spec-driven-steroids (always) - local MCP server
  const mcpLaunch = resolveMcpLaunchConfig();
  mcp['spec-driven-steroids'] = {
    type: 'local',
    command: [mcpLaunch.command, ...mcpLaunch.args]
  };

  // Add sequential-thinking MCP (optional)
  if (addSequentialThinkingMcp) {
    mcp['sequential-thinking'] = {
      type: 'local',
      command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking']
    };
  }

  // Add memory MCP (optional)
  if (addMemoryMcp) {
    mcp['memory'] = {
      type: 'local',
      command: ['npx', '-y', '@modelcontextprotocol/server-memory']
    };
  }

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

async function configureJetBrainsMcp(addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false) {
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

    const mcpLaunch = resolveMcpLaunchConfig();
    config.servers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      config.servers['sequential-thinking'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
      };
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      config.servers['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      };
    }

    delete config.mcpServers;

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green(`✅ JetBrains MCP configured at ${mcpConfigPath}`));
  } catch (error) {
    console.error(chalk.red('Failed to configure JetBrains MCP:'), error);
  }
}

async function configureVSCodeMcpGlobal(addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false): Promise<string> {
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

  const mcpLaunch = resolveMcpLaunchConfig();
  config.servers['spec-driven-steroids'] = {
    command: mcpLaunch.command,
    args: mcpLaunch.args
  };

  if (addSequentialThinkingMcp) {
    config.servers['sequential-thinking'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
    };
  }

  if (addMemoryMcp) {
    config.servers['memory'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory']
    };
  }

  delete config.mcpServers;

  await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  console.log(chalk.green(`✅ VS Code User Profile MCP configured at ${mcpConfigPath}`));
  return mcpConfigPath;
}

async function configureCodexMcp(targetDir: string, addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false) {
  try {
    const codexDir = path.join(targetDir, '.codex');
    await fs.ensureDir(codexDir);
    const mcpConfigPath = path.join(codexDir, 'config.toml');
    const mcpLaunch = resolveMcpLaunchConfig();
    const serverBlock = renderCodexMcpServerBlock('spec-driven-steroids', mcpLaunch);

    let configContent = '';
    if (await fs.pathExists(mcpConfigPath)) {
      configContent = await fs.readFile(mcpConfigPath, 'utf-8');
    }

    let updatedContent = upsertCodexMcpServerBlock(configContent, 'spec-driven-steroids', serverBlock);

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      const sequentialThinkingBlock = renderCodexMcpServerBlock('sequential-thinking', {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
      });
      updatedContent = upsertCodexMcpServerBlock(updatedContent, 'sequential-thinking', sequentialThinkingBlock);
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      const memoryBlock = renderCodexMcpServerBlock('memory', {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      });
      updatedContent = upsertCodexMcpServerBlock(updatedContent, 'memory', memoryBlock);
    }

    await fs.writeFile(mcpConfigPath, updatedContent, 'utf-8');
    console.log(chalk.green('✅ Created .codex/config.toml in project root.'));
  } catch (error) {
    console.error(chalk.red('Failed to configure Codex MCP:'), error);
  }
}

function renderCodexMcpServerBlock(serverName: string, launch: McpLaunchConfig): string {
  const quotedArgs = launch.args.map((arg) => `"${escapeTomlString(arg)}"`).join(', ');

  return [
    `[mcp_servers.${serverName}]`,
    `command = "${escapeTomlString(launch.command)}"`,
    `args = [${quotedArgs}]`
  ].join('\n');
}

function upsertCodexMcpServerBlock(existingContent: string, serverName: string, block: string): string {
  const trimmed = existingContent.trim();
  const normalized = trimmed ? `${trimmed}\n` : '';
  const pattern = new RegExp(`\\[mcp_servers\\.${escapeRegExp(serverName)}\\][\\s\\S]*?(?=\\n\\[|$)`, 'm');

  if (pattern.test(normalized)) {
    return normalized.replace(pattern, block).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  return `${normalized}${normalized ? '\n' : ''}${block}\n`;
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveMcpLaunchConfig(): McpLaunchConfig {
  return {
    command: 'node',
    args: [path.resolve(__dirname, '../mcp/index.js')]
  };
}

async function configureClaudeCodeMcp(targetDir: string, addSequentialThinkingMcp: boolean = false, addMemoryMcp: boolean = false) {
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

    // Add spec-driven-steroids MCP server
    const mcpLaunch = resolveMcpLaunchConfig();
    config.mcpServers!['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    // Add sequential-thinking MCP (optional)
    if (addSequentialThinkingMcp) {
      config.mcpServers!['sequential-thinking'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
      };
    }

    // Add memory MCP (optional)
    if (addMemoryMcp) {
      config.mcpServers!['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory']
      };
    }

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green('✅ Created .mcp.json in project root.'));
  } catch (error) {
    console.error(chalk.red('Failed to configure Claude Code MCP:'), error);
  }
}

const STEROIDS_SERVER_NAME = 'spec-driven-steroids';

const STEROIDS_FILES = {
  agents: ['spec-driven.agent.md'],
  commands: ['spec-driven.command.md', 'inject-guidelines.md']
} as const;

const STEROIDS_SKILL_DIRS = [
  'spec-driven-technical-designer',
  'spec-driven-task-implementer',
  'spec-driven-requirements-writer',
  'spec-driven-task-decomposer',
  'long-running-work-planning',
  'project-guidelines-writer'
] as const;

function buildCleanPreview(): string {
  const vscodeMcpPath = getVSCodeUserProfileMcpPath();
  const vscodePromptsDir = getVSCodeGlobalPromptsDir();
  const vscodeSkillsDir = getCopilotGlobalSkillsDir();
  const opencodeDir = getOpenCodeGlobalConfigDir();

  const formatDir = (d: string) => d.replace(os.homedir(), '~');

  const lines = [
    chalk.bold.cyan('🔍 Preview of --global clean:\n'),
    `  ${chalk.bold('GitHub Copilot for VS Code')}:`,
    `    • MCP entry: ${STEROIDS_SERVER_NAME} (${formatDir(vscodeMcpPath)})`,
    `    • Prompts: ${formatDir(vscodePromptsDir)}/`,
    `    • Skills: ${formatDir(vscodeSkillsDir)}/`,
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
