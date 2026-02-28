#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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

interface OpenCodeConfig {
  $schema?: string;
  mcp?: Record<string, McpServerLocal | McpServerRemote>;
}

interface McpServerLocal {
  type: 'local';
  command: string[];
  enabled?: boolean;
}

interface McpServerRemote {
  type: 'remote';
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
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

    const { platforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select platforms to support:',
        choices: [
          { name: 'GitHub Copilot for VS Code', value: 'github-vscode' },
          { name: 'GitHub Copilot for JetBrains', value: 'github-jetbrains' },
          { name: 'Google Antigravity', value: 'antigravity' },
          { name: 'OpenCode', value: 'opencode' }
        ],
        validate: (input: string[]) => input.length > 0 || 'Select at least one platform.'
      }
    ]);

    const targetDir = process.cwd();
    const standardsDir = path.resolve(__dirname, '../../templates');
    const universalSkillsDir = path.join(standardsDir, 'universal/skills');

    for (const platform of platforms) {
      console.log(chalk.yellow(`\nConfiguring ${platform}...`));

      try {
        let platformDest = '';
        let skillsSubDir = 'skills';

        if (platform === 'github-vscode') {
          await configureCopilotMcp(targetDir);
          const src = path.join(standardsDir, 'github');
          platformDest = path.join(targetDir, '.github');
          await fs.copy(src, platformDest, { overwrite: true });
        }

        if (platform === 'github-jetbrains') {
          await configureJetBrainsMcp();
          const src = path.join(standardsDir, 'github');
          platformDest = path.join(targetDir, '.github');
          await fs.copy(src, platformDest, { overwrite: true });
        }

        if (platform === 'antigravity') {
          await configureAntigravityMcp(targetDir);
          const src = path.join(standardsDir, 'antigravity');
          platformDest = path.join(targetDir, '.agent');
          await fs.copy(src, platformDest, { overwrite: true });
        }

        if (platform === 'opencode') {
          await configureOpenCodeMcp(targetDir);
          const src = path.join(standardsDir, 'opencode');
          platformDest = path.join(targetDir, '.opencode');
          await fs.copy(src, platformDest, { overwrite: true });

          // Specifically for OpenCode, we need to update opencode.json
          await updateOpenCodeConfig(targetDir);
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
  .command('validate')
  .description('Check if Spec-Driven standards are correctly configured')
  .action(async () => {
    const targetDir = process.cwd();
    console.log(chalk.cyan('\n🔍 Validating Spec-Driven setup...\n'));

    const checks = [
      { name: 'GitHub Copilot Config', path: '.github/agents' },
      { name: 'VS Code MCP Config', path: '.vscode/mcp.json' },
      { name: 'Antigravity Config', path: '.agent/workflows' },
      { name: 'OpenCode Config', path: '.opencode/skills' },
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

    // Add spec-driven-steroids (always)
    const mcpLaunch = resolveMcpLaunchConfig();
    config.servers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    delete config.mcpServers;

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure GitHub Copilot MCP:'), error);
  }
}

async function configureAntigravityMcp(targetDir: string) {
  try {
    const agentDir = path.join(targetDir, '.agent');
    await fs.ensureDir(agentDir);
    const configPath = path.join(agentDir, 'mcp_config.json');

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(configPath)) {
      try {
        config = await fs.readJson(configPath) as McpConfig;
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing Antigravity config.'));
      }
    }

    // Add spec-driven-steroids (always)
    const mcpLaunch = resolveMcpLaunchConfig();
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure Antigravity MCP:'), error);
  }
}

async function configureOpenCodeMcp(targetDir: string) {
  try {
    const configPath = path.join(targetDir, 'opencode.json');

    let config: OpenCodeConfig = {};
    if (await fs.pathExists(configPath)) {
      try {
        config = await fs.readJson(configPath);
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing opencode.json.'));
      }
    }

    if (!config.mcp) config.mcp = {};

    // Add spec-driven-steroids (always) - local MCP server
    const mcpLaunch = resolveMcpLaunchConfig();
    config.mcp['spec-driven-steroids'] = {
      type: 'local',
      command: [mcpLaunch.command, ...mcpLaunch.args]
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure OpenCode MCP:'), error);
  }
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

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as McpConfig;
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing JetBrains MCP config.'));
      }
    }

    const mcpLaunch = resolveMcpLaunchConfig();
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['spec-driven-steroids'] = {
      command: mcpLaunch.command,
      args: mcpLaunch.args
    };

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
    console.log(chalk.green(`✅ JetBrains MCP configured at ${mcpConfigPath}`));
  } catch (error) {
    console.error(chalk.red('Failed to configure JetBrains MCP:'), error);
  }
}

function resolveMcpLaunchConfig(): McpLaunchConfig {
  return {
    command: 'node',
    args: [path.resolve(__dirname, '../mcp/index.js')]
  };
}
