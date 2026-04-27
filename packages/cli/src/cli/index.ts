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
  getOpenCodeGlobalConfigDir
} from './opencode-scope.js';
import {
  GitHubCopilotInjectionScope,
  getVSCodeGlobalPromptsDir,
  getCopilotGlobalSkillsDir
} from './github-copilot-scope.js';
import {
  GitHubCopilotCliInjectionScope,
  getGitHubCopilotCliUserSkillsDir,
  getGitHubCopilotCliGlobalConfigDir
} from './github-copilot-cli-scope.js';
import {
  GeminiCliInjectionScope,
  getGeminiCliUserSkillsDir,
  getGeminiCliAgentsAliasDir
} from './gemini-cli-scope.js';
import {
  QwenCodeInjectionScope,
  getQwenCodeUserSkillsDir
} from './qwen-code-scope.js';
import { transformTemplates } from './transformation-pipeline.js';
import { createValidateCommand } from '../core/validate/index.js';
import { createStewardshipCommand } from '../context-stewardship/cli-command.js';

interface InjectionResult {
  platform: string;
  displayName: string;
  scope: string;
  ok: boolean;
  error: string;
}

const GLOBAL_CAPABLE_PLATFORMS = ['github-vscode', 'github-copilot-cli', 'gemini-cli', 'qwen-code', 'opencode'] as const;
type GlobalCapablePlatform = typeof GLOBAL_CAPABLE_PLATFORMS[number];

enum UnifiedInjectionScope {
  PROJECT = 'project',
  GLOBAL = 'global'
}

const UNIFIED_SCOPE_PROMPT_OPTIONS = [
  { name: 'Global (recommended - available across all projects)', value: UnifiedInjectionScope.GLOBAL },
  { name: 'Project-level (isolated to this project)', value: UnifiedInjectionScope.PROJECT }
];

const DEFAULT_UNIFIED_SCOPE = UnifiedInjectionScope.GLOBAL;

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../package.json');

function platformDisplayName(platform: string): string {
  switch (platform) {
    case 'github-vscode': return 'GitHub Copilot for VS Code';
    case 'github-jetbrains': return 'GitHub Copilot for JetBrains';
    case 'github-copilot-cli': return 'GitHub Copilot CLI';
    case 'gemini-cli': return 'Gemini CLI';
    case 'qwen-code': return 'Qwen Code';
    case 'antigravity': return 'Google Antigravity';
    case 'opencode': return 'OpenCode';
    case 'codex': return 'OpenAI Codex';
    case 'claudecode': return 'Claude Code';
    default: return platform;
  }
}

function renderInjectionSummary(
  results: InjectionResult[],
  templateSource: { source: 'remote' | 'bundled' | 'local'; version?: string; fallbackReason?: string },
  scopeLabel: string
): void {
  const okCount = results.filter(r => r.ok).length;
  const total = results.length;

  if (templateSource.source === 'remote' && templateSource.version) {
    console.log(chalk.bold(`Templates: remote (${templateSource.version})`));
  } else if (templateSource.fallbackReason) {
    console.log(chalk.yellow(`Templates: bundled (fallback: ${templateSource.fallbackReason})`));
  } else {
    console.log(chalk.yellow('Templates: bundled'));
  }
  console.log('');

  for (const r of results) {
    const status = r.ok ? chalk.green('OK') : chalk.red('FAIL');
    const pad = ' '.repeat(Math.max(1, 24 - r.displayName.length));
    if (r.ok) {
      console.log(`  ${r.displayName}${pad}${r.scope}   ${status}`);
    } else {
      console.log(`  ${r.displayName}${pad}${r.scope}   ${status}`);
      console.log(`    ${chalk.red(r.error)}`);
    }
  }

  console.log('');
  if (okCount === total) {
    console.log(chalk.bold(`${total} ${total === 1 ? 'platform' : 'platforms'} configured (${scopeLabel})`));
  } else {
    console.log(chalk.bold(`${okCount}/${total} platforms configured (${scopeLabel})`));
  }
}

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
program.addCommand(createStewardshipCommand());

program
   .command('inject')
  .description('Inject platform-specific Spec-Driven configs')
  .action(async () => {
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

    const selectedGlobalPlatforms = platforms.filter((p: string) => 
      GLOBAL_CAPABLE_PLATFORMS.includes(p as GlobalCapablePlatform)
    ) as GlobalCapablePlatform[];
    
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

    const scopeLabel = unifiedScope === UnifiedInjectionScope.GLOBAL ? 'global' : 'project';
    const results: InjectionResult[] = [];

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
      const displayName = platformDisplayName(platform);
      process.stdout.write(`  ${displayName}...`);
      try {
        let platformDest = '';
        let skillsSubDir = 'skills';
        let transformDestDir = '';

        if (platform === 'github-vscode') {
          if (githubScope === GitHubCopilotInjectionScope.GLOBAL) {
            const globalPromptsDir = getVSCodeGlobalPromptsDir();
            transformDestDir = globalPromptsDir;
            
            const globalSkillsDir = getCopilotGlobalSkillsDir();
            await fs.ensureDir(globalSkillsDir);
            await fs.copy(universalSkillsDir, globalSkillsDir, { overwrite: true });
          } else {
            platformDest = path.join(targetDir, '.github');
            transformDestDir = platformDest;
          }
        }

        if (platform === 'github-jetbrains') {
          platformDest = path.join(targetDir, '.github');
          transformDestDir = platformDest;
        }

        if (platform === 'antigravity') {
          platformDest = path.join(targetDir, '.agents');
          transformDestDir = platformDest;
        }

        if (platform === 'opencode') {
          if (openCodeScope === OpenCodeInjectionScope.GLOBAL) {
            const globalOpencodeDir = getOpenCodeGlobalConfigDir();
            transformDestDir = globalOpencodeDir;
            
            const globalSkillsDir = path.join(globalOpencodeDir, 'skills');
            await fs.ensureDir(globalSkillsDir);
            await fs.copy(universalSkillsDir, globalSkillsDir, { overwrite: true });
          } else {
            platformDest = path.join(targetDir, '.opencode');
            transformDestDir = platformDest;

            await updateOpenCodeConfig(targetDir);
          }
        }

        if (platform === 'codex') {
          platformDest = path.join(targetDir, '.codex');
          transformDestDir = platformDest;
        }

        if (platform === 'claudecode') {
          platformDest = path.join(targetDir, '.claude');
          transformDestDir = platformDest;
        }

        if (platform === 'github-copilot-cli') {
          if (githubCopilotCliScope === GitHubCopilotCliInjectionScope.USER) {
            const globalConfigDir = getGitHubCopilotCliGlobalConfigDir();
            platformDest = globalConfigDir;
            transformDestDir = globalConfigDir;
            skillsSubDir = 'skills';
          } else {
            platformDest = path.join(targetDir, '.github');
            transformDestDir = platformDest;
          }
        }

        if (platform === 'gemini-cli') {
          if (geminiCliScope === GeminiCliInjectionScope.USER) {
            platformDest = path.join(os.homedir(), '.gemini');
            transformDestDir = platformDest;
          } else {
            platformDest = path.join(targetDir, '.gemini');
            transformDestDir = platformDest;
          }
        }

        if (platform === 'qwen-code') {
          if (qwenCodeScope === QwenCodeInjectionScope.USER) {
            platformDest = path.join(os.homedir(), '.qwen');
            transformDestDir = platformDest;
          } else {
            platformDest = path.join(targetDir, '.qwen');
            transformDestDir = platformDest;
          }
        }

        if (transformDestDir) {
          const skipOutputTypes = (platform === 'github-vscode' && githubScope === GitHubCopilotInjectionScope.GLOBAL)
            ? ['inject-guidelines-command']
            : undefined;

          await transformTemplates(
            [platform],
            standardsDir,
            () => transformDestDir,
            { skipOutputTypes }
          );

          if (platform === 'github-vscode' && githubScope === GitHubCopilotInjectionScope.GLOBAL) {
            await flattenVSCodeGlobalPrompts(transformDestDir);
          }
        }

        if (platformDest) {
          const destSkillsDir = path.join(platformDest, skillsSubDir);
          await fs.ensureDir(destSkillsDir);
          await fs.copy(universalSkillsDir, destSkillsDir, { overwrite: true });
        }

        if (platform === 'gemini-cli' && geminiCliScope === GeminiCliInjectionScope.USER) {
          const nativeSkillsDir = getGeminiCliUserSkillsDir();
          const aliasDir = getGeminiCliAgentsAliasDir();
          await fs.ensureDir(aliasDir);
          await fs.copy(nativeSkillsDir, aliasDir, { overwrite: true });
        }

        results.push({ platform, displayName, scope: scopeLabel, ok: true, error: '' });
        console.log(chalk.green(` ok (${scopeLabel})`));

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ platform, displayName, scope: scopeLabel, ok: false, error: errorMsg });
        console.log(chalk.red(` fail (${scopeLabel})`));
      }
    }

    renderInjectionSummary(results, templateSource, scopeLabel);
    if (results.some(r => !r.ok)) {
      process.exitCode = 1;
    }
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

async function updateOpenCodeConfig(targetDir: string) {
  const configPath = path.join(targetDir, 'opencode.json');
  if (!await fs.pathExists(configPath)) return;

  const config = await fs.readJson(configPath);

  if (!config.$schema) {
    config.$schema = 'https://opencode.ai/config.json';
  }

  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log(chalk.green('✅ opencode.json updated with schema.'));
}

function buildCleanPreview(): string {
  const vscodePromptsDir = getVSCodeGlobalPromptsDir();
  const vscodeSkillsDir = getCopilotGlobalSkillsDir();
  const opencodeDir = getOpenCodeGlobalConfigDir();
  const githubCopilotCliSkillsDir = getGitHubCopilotCliUserSkillsDir();
  const geminiCliSkillsDir = getGeminiCliUserSkillsDir();
  const qwenCodeSkillsDir = getQwenCodeUserSkillsDir();

  const formatDir = (d: string) => d.replace(os.homedir(), '~');

  const lines = [
    chalk.bold.cyan('🔍 Preview of --global clean:\n'),
    `  ${chalk.bold('GitHub Copilot for VS Code')}:`,
    `    • Prompts: ${formatDir(vscodePromptsDir)}/`,
    `    • Skills: ${formatDir(vscodeSkillsDir)}/`,
    '',
    `  ${chalk.bold('GitHub Copilot CLI')}:`,
    `    • Skills: ${formatDir(githubCopilotCliSkillsDir)}/`,
    '',
    `  ${chalk.bold('Gemini CLI')}:`,
    `    • Skills: ${formatDir(geminiCliSkillsDir)}/`,
    '',
    `  ${chalk.bold('Qwen Code')}:`,
    `    • Skills: ${formatDir(qwenCodeSkillsDir)}/`,
    '',
    `  ${chalk.bold('OpenCode')} (${formatDir(opencodeDir)}):`,
    `    • agents/${STEROIDS_FILES.agents.join(', ')}`,
    `    • commands/${STEROIDS_FILES.commands.join(', ')}`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    ''
  ];

  return lines.join('\n');
}

async function removeVSCodeGlobalSteroids(): Promise<boolean> {
  try {
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
    await removeSteroidsSkillDirs(getGitHubCopilotCliGlobalConfigDir());
    console.log(chalk.green('  ✅ GitHub Copilot CLI cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ GitHub Copilot CLI: ${err}`));
    return false;
  }
}

async function removeGeminiCliSteroids(): Promise<boolean> {
  try {
    await removeGeminiCliGlobalFiles();
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.gemini'));
    const aliasDir = path.join(os.homedir(), '.agents', 'skills');
    if (await fs.pathExists(aliasDir)) {
      for (const skill of STEROIDS_SKILL_DIRS) {
        const skillPath = path.join(aliasDir, skill);
        if (await fs.pathExists(skillPath)) {
          await fs.remove(skillPath);
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
      await fs.remove(file);
    }
  }

  for (const dir of ['agents', 'commands']) {
    const dirPath = path.join(os.homedir(), '.gemini', dir);
    const remaining = await fs.readdir(dirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(dirPath);
    }
  }
}

async function removeQwenCodeSteroids(): Promise<boolean> {
  try {
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.qwen'));
    console.log(chalk.green('  ✅ Qwen Code cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Qwen Code: ${err}`));
    return false;
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
