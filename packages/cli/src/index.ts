#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCP_SERVERS } from './mcp-registry.js';

interface McpConfig {
  mcpServers: Record<string, McpServerEntry>;
}

interface McpServerEntry {
  command: string;
  args: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use McpConfig interface to satisfy linter

const program = new Command();

program
  .name('spec-driven-steroids')
  .description('Inject Spec Driven standards into your repository')
  .version('0.1.0');

program
  .command('inject')
  .description('Inject platform-specific Spec Driven configs')
  .action(async () => {
    console.log(chalk.bold.cyan('\n💪 Injecting steroids...\n'));

    const { platforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select platforms to support:',
        choices: [
          { name: 'GitHub Copilot for VSCode', value: 'github' },
          { name: 'Google Antigravity', value: 'antigravity' },
          { name: 'OpenCode', value: 'opencode' }
        ],
        validate: (input: string[]) => input.length > 0 || 'Select at least one platform.'
      }
    ]);

    const { mcpServers } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'mcpServers',
        message: 'Select MCP servers to configure (select category headers for groups):',
        choices: getMcpChoices()
      }
    ]) as { mcpServers: string[] };

    const targetDir = process.cwd();
    const standardsDir = path.resolve(__dirname, '../../standards/src/templates');
    const universalSkillsDir = path.join(standardsDir, 'universal/skills');

    for (const platform of platforms) {
      console.log(chalk.yellow(`\nConfiguring ${platform}...`));

      try {
        let platformDest = '';
        let skillsSubDir = 'skills';

        if (platform === 'github') {
          await configureCopilotMcp(targetDir, mcpServers);
          const src = path.join(standardsDir, 'github');
          platformDest = path.join(targetDir, '.github');
          await fs.copy(src, platformDest, { overwrite: true });
        }

        if (platform === 'antigravity') {
          await configureAntigravityMcp(targetDir, mcpServers);
          const src = path.join(standardsDir, 'antigravity');
          platformDest = path.join(targetDir, '.agent');
          await fs.copy(src, platformDest, { overwrite: true });
        }

        if (platform === 'opencode') {
          await configureOpenCodeMcp(targetDir, mcpServers);
          const src = path.join(standardsDir, 'opencode');
          platformDest = path.join(targetDir, '.opencode');
          await fs.copy(src, platformDest, { overwrite: true });

          // Specifically for OpenCode, we need to update opencode.json
          await updateOpenCodeConfig(targetDir, universalSkillsDir);
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
    printMcpSummary(mcpServers);
    console.log(chalk.white('Next steps:'));
    console.log(chalk.white('1. Configure API keys for MCP servers that require them.'));
    console.log(chalk.white('2. Ensure your MCP servers are running.'));
    console.log(chalk.white('3. Use @spec-driven in Copilot or /spec-driven in Antigravity.\n'));
  });

program
  .command('validate')
  .description('Check if Spec Driven standards are correctly configured')
  .action(async () => {
    const targetDir = process.cwd();
    console.log(chalk.cyan('\n🔍 Validating Spec Driven setup...\n'));

    const checks = [
      { name: 'GitHub Config', path: '.github/agents' },
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

program.parse();

function getMcpChoices() {
  const mcpChoices = MCP_SERVERS.map(server => ({
    name: `${server.name}${server.requiresApiKey ? ' (requires API key)' : ''}`,
    value: server.id,
    short: server.name
  }));

  return [
    ...mcpChoices,
    new inquirer.Separator(),
    { name: 'Select all MCP servers', value: 'all' }
  ];
}

async function addMcpsToConfig(
  config: any,
  selectedMcpIds: string[]
): Promise<void> {
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  for (const serverId of selectedMcpIds) {
    const server = MCP_SERVERS.find(s => s.id === serverId);
    if (!server) continue;

    const configKey = server.id;
    config.mcpServers[configKey] = {
      command: server.command,
      args: server.args
    };

    // NO API KEY PROMPTS - just informational message
    if (server.requiresApiKey) {
      console.log(chalk.gray(`  ℹ️  ${server.name} added (requires API key configuration)`));
      console.log(chalk.white(`     See docs: ${server.documentationUrl}`));
    } else {
      console.log(chalk.green(`  ✅ ${server.name} added`));
    }
  }
}

async function configureCopilotMcp(targetDir: string, selectedMcpIds: string[]) {
  try {
    const vscodeDir = path.join(targetDir, '.vscode');
    await fs.ensureDir(vscodeDir);
    const mcpConfigPath = path.join(vscodeDir, 'mcp.json');

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        config = await fs.readJson(mcpConfigPath) as McpConfig;
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing .vscode/mcp.json.'));
      }
    }

    // Add spec-driven-steroids (always)
    config.mcpServers['spec-driven-steroids'] = {
      command: 'pnpm',
      args: ['dlx', '@spec-driven-steroids/mcp']
    };

    // Add selected MCP servers
    await addMcpsToConfig(config, selectedMcpIds);

    await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure GitHub Copilot MCP:'), error);
  }
}

async function configureAntigravityMcp(targetDir: string, selectedMcpIds: string[]) {
  try {
    const agentDir = path.join(targetDir, '.agent');
    await fs.ensureDir(agentDir);
    const configPath = path.join(agentDir, 'mcp_config.json');

    let config: McpConfig = { mcpServers: {} };
    if (await fs.pathExists(configPath)) {
      try {
        config = await fs.readJson(configPath) as McpConfig;
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing Antigravity config.'));
      }
    }

    // Add spec-driven-steroids (always)
    config.mcpServers['spec-driven-steroids'] = {
      command: 'pnpm',
      args: ['dlx', '@spec-driven-steroids/mcp']
    };

    // Add selected MCP servers
    await addMcpsToConfig(config, selectedMcpIds);

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure Antigravity MCP:'), error);
  }
}

async function configureOpenCodeMcp(targetDir: string, selectedMcpIds: string[]) {
  try {
    const configPath = path.join(targetDir, 'opencode.json');

    let config: any = { mcpServers: {} };
    if (await fs.pathExists(configPath)) {
      try {
        config = await fs.readJson(configPath);
      } catch (e) {
        console.warn(chalk.yellow('Warning: Could not parse existing opencode.json.'));
      }
    } else {
      config = { name: path.basename(targetDir), skills: [], mcpServers: {} };
    }

    if (!config.mcpServers) config.mcpServers = {};

    // Add spec-driven-steroids (always)
    config.mcpServers['spec-driven-steroids'] = {
      command: 'pnpm',
      args: ['dlx', '@spec-driven-steroids/mcp']
    };

    // Add selected MCP servers
    await addMcpsToConfig(config, selectedMcpIds);

    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to configure OpenCode MCP:'), error);
  }
}

async function updateOpenCodeConfig(targetDir: string, universalSkillsDir: string) {
  const configPath = path.join(targetDir, 'opencode.json');
  if (!await fs.pathExists(configPath)) return;

  const config = await fs.readJson(configPath);
  const skills = await fs.readdir(universalSkillsDir);

  if (!config.skills) config.skills = [];

  for (const skillName of skills) {
    const skillPath = `.opencode/skills/${skillName}/SKILL.md`;
    if (!config.skills.includes(skillPath)) {
      config.skills.push(skillPath);
    }
  }

  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log(chalk.green('✅ opencode.json updated with injected skills.'));
}

function printMcpSummary(selectedMcpIds: string[]) {
  if (selectedMcpIds.length === 0) return;

  const configuredServers = selectedMcpIds
    .map(id => MCP_SERVERS.find(s => s.id === id))
    .filter((s): s is typeof MCP_SERVERS[number] => s !== undefined);

  console.log(chalk.bold.cyan('\n✅ MCP Servers Configured:'));
  for (const server of configuredServers) {
    console.log(chalk.green(`  ✓ ${server.name}`));
  }

  const requiresApiKey = configuredServers.some(server => server.requiresApiKey === true);
  if (requiresApiKey) {
    console.log(chalk.yellow('\n⚠️  Some servers require API key configuration.'));
    console.log(chalk.white('   Check documentation for setup instructions:'));
    console.log(chalk.gray('     https://github.com/modelcontextprotocol/servers'));
  }
}
