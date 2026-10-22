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
  getOpenCodeGlobalConfigDir
} from './opencode-scope.js';
import {
  getVSCodeGlobalPromptsDir,
  getCopilotGlobalSkillsDir
} from './github-copilot-scope.js';
import {
  getGitHubCopilotCliGlobalConfigDir
} from './github-copilot-cli-scope.js';
import {
  getPlatformDefinition,
  getPlatformDefinitions,
  getGlobalCapablePlatforms,
  resolvePlatformScope,
  type InjectionScope
} from './platform-registry.js';
import { transformTemplates } from './transformation-pipeline.js';
import { getCliVersion, getBundledTemplatesDir } from './version.js';
import { flattenPromptFiles, resolveFlattenedPromptPaths } from './vscode-prompts.js';
import { createValidateCommand } from '../core/validate/index.js';
import { createStewardshipCommand } from '../context-stewardship/cli-command.js';
import {
  createDoctorCommand,
  createRepairCommand,
  createTemplatesCommand,
  createUninstallCommand
} from '../commands/manifest-commands.js';
import {
  buildInstalledFiles,
  collectFiles,
  getConfigDir,
  getManifestPath,
  readManifest,
  cleanManifest,
  listManifests,
  writeManifest,
  type InstallManifest
} from './install-manifest.js';

interface InjectionResult {
  platform: string;
  displayName: string;
  scope: string;
  ok: boolean;
  error: string;
  files?: string[];
  dryRun?: boolean;
}

const GLOBAL_CAPABLE_PLATFORMS = new Set(getGlobalCapablePlatforms().map(definition => definition.id));

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
  'spec-driven-brief-planner',
  'spec-driven-shared-protocol',
  'long-running-work-planning',
  'project-guidelines-writer',
  'agent-work-auditor',
  'code-review-hardening',
  'contextual-stewardship',
  'quality-grading',
  'universal-live-check'
] as const;

const CLINE_EXTRA_SKILL_DIRS = ['spec-driven', 'inject-guidelines'] as const;

const ANTIGRAVITY_EXTRA_SKILL_DIRS = ['spec-driven', 'inject-guidelines'] as const;

const __filename = fileURLToPath(import.meta.url);

function platformDisplayName(platform: string): string {
  return getPlatformDefinition(platform)?.displayName ?? platform;
}

function getEffectiveScope(platform: string, unifiedScope: UnifiedInjectionScope): InjectionScope {
  const definition = getPlatformDefinition(platform);
  if (!definition) return 'project';
  return resolvePlatformScope(
    definition,
    unifiedScope === UnifiedInjectionScope.GLOBAL ? 'global' : 'project'
  );
}

function summarizeScope(results: InjectionResult[]): string {
  const scopes = [...new Set(results.map(result => result.scope))];
  return scopes.length === 1 ? scopes[0] : 'mixed';
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

export function createProgram(): Command {
const program = new Command();

program
  .name('spec-driven-steroids')
  .alias('sds')
  .description('Inject Spec-Driven standards into your repository')
  .version(getCliVersion());

program.addCommand(createValidateCommand());
program.addCommand(createStewardshipCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createRepairCommand());
program.addCommand(createUninstallCommand());
program.addCommand(createTemplatesCommand());

program
   .command('inject')
  .description('Inject platform-specific Spec-Driven configs')
  .option('--platform <ids>', 'Comma-separated platform IDs (skips the platform prompt)')
  .option('--scope <scope>', 'Injection scope: global or project')
  .option('--templates <source>', 'Template source: bundled or remote')
  .option('--dry-run', 'Show planned files without writing them')
  .option('--json', 'Emit a machine-readable JSON summary')
  .option('--backup', 'Back up existing platform roots before writing')
  .option('--yes', 'Skip prompts when --platform is provided')
  .action(async (opts: {
    platform?: string;
    scope?: string;
    templates?: string;
    dryRun?: boolean;
    json?: boolean;
    backup?: boolean;
    yes?: boolean;
  }) => {
    const log = opts.json ? () => undefined : console.log;
    let platforms: string[];

    if (opts.platform) {
      platforms = opts.platform.split(',').map(value => value.trim()).filter(Boolean);
      const unknown = platforms.filter(platform => !getPlatformDefinition(platform));
      if (unknown.length > 0) {
        console.error(chalk.red(`Error: Unknown platform(s): ${unknown.join(', ')}`));
        process.exitCode = 2;
        return;
      }
    } else {
      if (opts.yes) {
        console.error(chalk.red('Error: --yes requires --platform.'));
        process.exitCode = 2;
        return;
      }
      const answer = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'platforms',
          message: 'Select platforms to support:',
          choices: getPlatformDefinitions().map(definition => ({
            name: definition.displayName,
            value: definition.id
          })),
          validate: (input: string[]) => input.length > 0 || 'Select at least one platform.'
        }
      ]);
      platforms = answer.platforms;
    }

    const selectedGlobalPlatforms = platforms.filter((p: string) => GLOBAL_CAPABLE_PLATFORMS.has(p));
    
    let unifiedScope = DEFAULT_UNIFIED_SCOPE;
    if (opts.scope) {
      if (!['global', 'project'].includes(opts.scope)) {
        console.error(chalk.red("Error: --scope must be 'global' or 'project'."));
        process.exitCode = 2;
        return;
      }
      unifiedScope = opts.scope === 'global'
        ? UnifiedInjectionScope.GLOBAL
        : UnifiedInjectionScope.PROJECT;
    } else if (selectedGlobalPlatforms.length > 0 && !opts.yes) {
      const platformNames = selectedGlobalPlatforms
        .map((p: string) => platformDisplayName(p))
        .join(', ');
      
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

    if (opts.templates && !['bundled', 'remote'].includes(opts.templates)) {
      console.error(chalk.red("Error: --templates must be 'bundled' or 'remote'."));
      process.exitCode = 2;
      return;
    }

    const results: InjectionResult[] = [];

    const targetDir = process.cwd();
    const bundledTemplatesDir = getBundledTemplatesDir();
    const templateSource = await resolveTemplateSource({
      bundledTemplatesDir,
      cliVersion: getCliVersion(),
      source: opts.templates as 'bundled' | 'remote' | undefined
    });
    const standardsDir = templateSource.rootDir;
    const universalSkillsDir = path.join(standardsDir, 'universal/skills');

    if (templateSource.source === 'remote') {
      log(chalk.green(`Using remote templates (${templateSource.version}).`));
    } else {
      log(chalk.yellow('Using bundled templates.'));
      if (templateSource.fallbackReason) {
        if (templateSource.errorKind) {
          log(chalk.yellow(`Remote template retrieval failed, so inject fell back to bundled templates: ${templateSource.fallbackReason}`));
        } else {
          log(chalk.yellow(templateSource.fallbackReason));
        }
      }
    }
    for (const warning of templateSource.warnings) {
      log(chalk.yellow(`Template warning: ${warning}`));
    }

    for (const platform of platforms) {
      const displayName = platformDisplayName(platform);
      const platformScope = getEffectiveScope(platform, unifiedScope);
      if (!opts.json && !opts.dryRun) {
        process.stdout.write(`  ${displayName}...`);
      }
      try {
        const definition = getPlatformDefinition(platform);
        if (!definition) {
          throw new Error(`Unknown platform: ${platform}`);
        }

        const effectiveScope = resolvePlatformScope(
          definition,
          unifiedScope === UnifiedInjectionScope.GLOBAL ? 'global' : 'project'
        );
        const platformRoot = definition.resolveRoot(effectiveScope, { cwd: targetDir, home: os.homedir() });
        const skillsRoot = definition.resolveSkillsRoot(effectiveScope, { cwd: targetDir, home: os.homedir() });

        if (platform === 'opencode' && effectiveScope === 'project' && !opts.dryRun) {
          await updateOpenCodeConfig(targetDir);
        }

        if (opts.backup && !opts.dryRun) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupRoot = path.join(getConfigDir(), 'backups', platform, effectiveScope, timestamp);
          if (await fs.pathExists(platformRoot)) {
            const destination = path.join(backupRoot, 'root');
            await fs.copy(platformRoot, destination, { overwrite: true });
            log(chalk.gray(`  backup: ${destination}`));
          }
          if (!isPathInside(platformRoot, skillsRoot) && await fs.pathExists(skillsRoot)) {
            const destination = path.join(backupRoot, 'skills');
            await fs.copy(skillsRoot, destination, { overwrite: true });
            log(chalk.gray(`  backup: ${destination}`));
          }
        }

        const skipOutputTypes = platform === 'github-vscode' && effectiveScope === 'global'
          ? definition.skipOutputTypes
          : undefined;

        const transformResults = await transformTemplates(
          [platform],
          standardsDir,
          () => platformRoot,
          { skipOutputTypes, dryRun: opts.dryRun }
        );

        const failedTransforms = transformResults.filter(result => !result.success);
        if (failedTransforms.length > 0) {
          const details = failedTransforms
            .map(result => `${result.sourcePath}: ${result.error ?? 'unknown error'}`)
            .join('; ');
          throw new Error(`Template transformation failed: ${details}`);
        }

        const transformedFiles = transformResults
          .map(result => result.outputPath)
          .filter((outputPath): outputPath is string => outputPath.length > 0);

        const flattensPrompts = definition.postProcess === 'flatten-vscode-prompts' && effectiveScope === 'global';
        const writtenFiles = flattensPrompts
          ? resolveFlattenedPromptPaths(platformRoot, transformedFiles)
          : transformedFiles;

        if (!opts.dryRun && flattensPrompts) {
          await flattenPromptFiles(platformRoot, transformedFiles);
        }
        if (!opts.dryRun && definition.postProcess === 'remove-codex-legacy-commands') {
          await removeCodexLegacyCommands(platformRoot);
        }

        const skillFiles = (await collectFiles(universalSkillsDir))
          .map(file => path.join(skillsRoot, path.relative(universalSkillsDir, file)));

        if (!opts.dryRun) {
          await fs.ensureDir(skillsRoot);
          await fs.copy(universalSkillsDir, skillsRoot, { overwrite: true });

          const installedFiles = await buildInstalledFiles([...writtenFiles, ...skillFiles]);

          const previousManifest = await readManifest(getManifestPath(platform, effectiveScope, platformRoot));
          if (previousManifest) {
            const currentPaths = new Set(installedFiles.map(file => file.path));
            const staleFiles = previousManifest.files.filter(file => !currentPaths.has(file.path));
            if (staleFiles.length > 0) {
              await cleanManifest({ ...previousManifest, files: staleFiles });
            }
          }

          const manifest: InstallManifest = {
            version: 1,
            platform,
            scope: effectiveScope,
            root: platformRoot,
            skillsRoot,
            cliVersion: getCliVersion(),
            templateVersion: templateSource.version,
            installedAt: new Date().toISOString(),
            files: installedFiles
          };
          await writeManifest(manifest);
        }

        const plannedFiles = [...writtenFiles, ...skillFiles];
        results.push({ platform, displayName, scope: effectiveScope, ok: true, error: '', files: plannedFiles, dryRun: opts.dryRun });
        log(chalk.green(` ok (${effectiveScope})`));

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ platform, displayName, scope: platformScope, ok: false, error: errorMsg });
        log(chalk.red(` fail (${platformScope})`));
      }
    }

    if (opts.json) {
      console.log(JSON.stringify({
        templateSource: {
          source: templateSource.source,
          version: templateSource.version,
          fallbackReason: templateSource.fallbackReason,
          warnings: templateSource.warnings
        },
        scope: summarizeScope(results),
        dryRun: opts.dryRun === true,
        results
      }, null, 2));
    } else {
      renderInjectionSummary(results, templateSource, summarizeScope(results));
      if (opts.dryRun) {
        for (const result of results) {
          for (const file of result.files ?? []) {
            console.log(`  would write: ${file}`);
          }
        }
        console.log(chalk.yellow('\nDry run: no files were written.'));
      }
    }
    if (results.some(r => !r.ok)) {
      process.exitCode = 1;
    }
  });

program
  .command('clean')
  .description('Remove globally injected Spec-Driven Steroids')
  .option('--global', 'Clean global steroids from all platforms (default)')
  .option('--project', 'Clean project-level steroids in the current directory')
  .option('--platform <platform>', 'Limit cleanup to one platform')
  .option('--force', 'Remove files even if they were modified after installation')
  .option('--dry-run', 'Show what would be removed without deleting anything')
  .option('--json', 'Emit a machine-readable JSON summary')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async ({ yes, dryRun, project, platform, force, json }) => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    let restored = false;

    const restoreConsole = () => {
      if (restored) return;
      restored = true;
      console.log = originalLog;
      console.warn = originalWarn;
    };

    const finish = (payload?: unknown) => {
      restoreConsole();
      if (json && payload !== undefined) {
        console.log(JSON.stringify(payload, null, 2));
      }
    };

    if (json) {
      console.log = () => undefined;
      console.warn = () => undefined;
    }

    try {
      await runCleanAction({ yes, dryRun, project, platform, force, finish });
    } finally {
      restoreConsole();
    }
  });

  async function runCleanAction(options: {
    yes?: boolean;
    dryRun?: boolean;
    project?: boolean;
    platform?: string;
    force?: boolean;
    finish: (payload?: unknown) => void;
  }): Promise<void> {
    const { yes, dryRun, project, platform, force, finish } = options;
    const scope = project ? 'project' : 'global';
    if (platform && !getPlatformDefinition(platform)) {
      console.error(chalk.red(`Error: Unknown platform: ${platform}`));
      finish({ scope, error: `Unknown platform: ${platform}` });
      process.exitCode = 2;
      return;
    }
    console.log(chalk.bold.cyan(`\n🧹 Cleaning ${scope} steroids...\n`));

    const preview = buildCleanPreview();
    console.log(preview);

    if (dryRun) {
      const result = await cleanInstalledManifests({
        scope,
        projectRoot: process.cwd(),
        platform,
        force,
        dryRun: true
      });
      for (const file of result.removed) console.log(`  would remove: ${file}`);
      for (const file of result.skipped) console.log(chalk.yellow(`  would skip (modified): ${file}`));
      console.log(chalk.yellow('\nDry run: no files were removed.'));
      finish({ scope, dryRun: true, removed: result.removed, skipped: result.skipped });
      return;
    }

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
        finish({ scope, aborted: true });
        return;
      }
    }

    console.log(chalk.cyan('\n'));

    const manifestResult = await cleanInstalledManifests({
      scope,
      projectRoot: process.cwd(),
      platform,
      force
    });

    if (manifestResult.removed.length > 0) {
      console.log(chalk.green(`  ✅ Removed ${manifestResult.removed.length} manifest-tracked file(s).`));
    }
    if (manifestResult.skipped.length > 0) {
      console.log(chalk.yellow(`  ⚠️ Skipped ${manifestResult.skipped.length} modified file(s). Use --force to remove them.`));
    }

    if (scope === 'project') {
      const legacyRemoved = manifestResult.found === 0
        ? await cleanLegacyProjectInstall(process.cwd(), platform)
        : 0;
      if (manifestResult.removed.length === 0 && manifestResult.skipped.length === 0 && legacyRemoved === 0) {
        console.log(chalk.yellow('  No project install manifests or legacy project files found.'));
      }
      finish({
        scope,
        removed: manifestResult.removed,
        skipped: manifestResult.skipped,
        manifests: manifestResult.cleaned,
        legacyRemoved
      });
      return;
    }

    const results = await Promise.all(
      platform
        ? [runLegacyPlatformCleanup(platform)]
        : [
            removeVSCodeGlobalSteroids(),
            removeGitHubCopilotCliSteroids(),
            removeGeminiCliSteroids(),
            removeQwenCodeSteroids(),
            removeQoderSteroids(),
            removeOpenCodeGlobalSteroids(),
            removeClineSteroids(),
            removeAntigravityIdeSteroids(),
            removeAntigravityCliSteroids()
          ]
    );

    const allCleaned = results.every(r => r);
    if (allCleaned) {
      console.log(chalk.bold.green('\n✅ All global steroids cleaned successfully.'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️ Some platforms could not be fully cleaned.'));
      process.exitCode = 1;
    }
    finish({
      scope,
      removed: manifestResult.removed,
      skipped: manifestResult.skipped,
      manifests: manifestResult.cleaned,
      legacy: results
    });
  }

  return program;
}

const program = createProgram();

function isCliEntrypoint(): boolean {
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

async function runLegacyPlatformCleanup(platform: string): Promise<boolean> {
  switch (platform) {
    case 'github-vscode': return removeVSCodeGlobalSteroids();
    case 'github-copilot-cli': return removeGitHubCopilotCliSteroids();
    case 'gemini-cli': return removeGeminiCliSteroids();
    case 'qwen-code': return removeQwenCodeSteroids();
    case 'qoder': return removeQoderSteroids();
    case 'opencode': return removeOpenCodeGlobalSteroids();
    case 'cline': return removeClineSteroids();
    case 'antigravity': return removeAntigravityIdeSteroids();
    case 'antigravity-cli': return removeAntigravityCliSteroids();
    default:
      console.warn(chalk.yellow(`  ⚠️ No legacy cleanup available for ${platform}.`));
      return true;
  }
}

async function cleanLegacyProjectInstall(targetDir: string, platformFilter?: string): Promise<number> {
  let removed = 0;

  for (const definition of getPlatformDefinitions()) {
    if (!definition.supportedScopes.includes('project')) continue;
    if (platformFilter && definition.id !== platformFilter) continue;

    const root = definition.resolveRoot('project', { cwd: targetDir, home: os.homedir() });
    const config = definition.config;
    const candidates: string[] = [
      path.join(root, config.agentDirectory, config.agentFilename)
    ];

    if (config.commandSkills || config.skillsOnly) {
      candidates.push(
        path.join(root, 'skills', 'spec-driven', 'SKILL.md'),
        path.join(root, 'skills', 'inject-guidelines', 'SKILL.md')
      );
    } else {
      if (config.specDrivenCommandFilename) {
        candidates.push(path.join(root, config.commandDirectory, config.specDrivenCommandFilename));
      }
      if (config.injectGuidelinesCommandFilename) {
        candidates.push(path.join(root, config.commandDirectory, config.injectGuidelinesCommandFilename));
      }
    }

    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        await fs.remove(candidate);
        removed += 1;
      }
    }

    await removeSteroidsSkillDirs(root);
    for (const skill of ['spec-driven', 'inject-guidelines']) {
      const skillPath = path.join(root, 'skills', skill);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
      }
    }

    for (const directory of ['agents', 'commands', 'prompts', 'skills']) {
      const directoryPath = path.join(root, directory);
      const remaining = await fs.readdir(directoryPath).catch(() => []);
      if (remaining.length === 0) {
        await fs.remove(directoryPath).catch(() => undefined);
      }
    }
  }

  return removed;
}

async function cleanInstalledManifests(options: {
  scope: 'global' | 'project';
  projectRoot?: string;
  force?: boolean;
  dryRun?: boolean;
  platform?: string;
}): Promise<{ removed: string[]; skipped: string[]; cleaned: number; found: number }> {
  const manifests = (await listManifests()).filter(manifest => {
    if (manifest.scope !== options.scope) return false;
    if (options.platform && manifest.platform !== options.platform) return false;
    if (options.scope === 'project') {
      const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
      const manifestRoot = path.resolve(manifest.root);
      return manifestRoot === projectRoot || manifestRoot.startsWith(`${projectRoot}${path.sep}`);
    }
    return true;
  });

  const removed: string[] = [];
  const skipped: string[] = [];
  let cleaned = 0;

  for (const manifest of manifests) {
    const result = await cleanManifest(manifest, { force: options.force, dryRun: options.dryRun });
    removed.push(...result.removed);
    skipped.push(...result.skipped);
    if (result.removed.length > 0 || result.missing.length > 0) {
      cleaned += 1;
    }
  }

  return { removed, skipped, cleaned, found: manifests.length };
}

function buildCleanPreview(): string {
  const vscodePromptsDir = getVSCodeGlobalPromptsDir();
  const vscodeSkillsDir = getCopilotGlobalSkillsDir();
  const opencodeDir = getOpenCodeGlobalConfigDir();
  const copilotCliDir = getGitHubCopilotCliGlobalConfigDir();
  const geminiDir = path.join(os.homedir(), '.gemini');
  const qwenDir = path.join(os.homedir(), '.qwen');
  const qoderDir = path.join(os.homedir(), '.qoder');
  const antigravityIdeDir = path.join(os.homedir(), '.gemini', 'config');
  const antigravityCliDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');

  const formatDir = (d: string) => d.replace(os.homedir(), '~');

  const lines = [
    chalk.bold.cyan('🔍 Preview of --global clean:\n'),
    `  ${chalk.bold('GitHub Copilot for VS Code')}:`,
    `    • ${formatDir(vscodePromptsDir)}/spec-driven.agent.md`,
    `    • ${formatDir(vscodePromptsDir)}/spec-driven.prompt.md`,
    `    • skills/ under ${formatDir(vscodeSkillsDir)}/`,
    '',
    `  ${chalk.bold('GitHub Copilot CLI')} (${formatDir(copilotCliDir)}):`,
    `    • agents/spec-driven.agent.md`,
    `    • commands/spec-driven.md, commands/inject-guidelines.md`,
    `    • skills/`,
    '',
    `  ${chalk.bold('Gemini CLI')} (${formatDir(geminiDir)}):`,
    `    • agents/spec-driven.md`,
    `    • commands/spec-driven.toml, commands/inject-guidelines.toml`,
    `    • commands/spec-driven.md, commands/inject-guidelines.md`,
    `    • skills/`,
    '',
    `  ${chalk.bold('Qwen Code')} (${formatDir(qwenDir)}):`,
    `    • agents/spec-driven.agent.md`,
    `    • commands/spec-driven.md, commands/inject-guidelines.md`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    '',
    `  ${chalk.bold('Qoder CLI / IDE')} (${formatDir(qoderDir)}):`,
    `    • agents/spec-driven.md`,
    `    • commands/spec-driven.md, commands/inject-guidelines.md`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    '',
    `  ${chalk.bold('Cline')} (${formatDir(path.join(os.homedir(), '.cline'))}):`,
    `    • skills/spec-driven/SKILL.md`,
    `    • skills/inject-guidelines/SKILL.md`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    '',
    `  ${chalk.bold('OpenCode')} (${formatDir(opencodeDir)}):`,
    `    • agents/${STEROIDS_FILES.agents.join(', ')}`,
    `    • commands/${STEROIDS_FILES.commands.join(', ')}`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    '',
    `  ${chalk.bold('Google Antigravity IDE')} (${formatDir(antigravityIdeDir)}):`,
    `    • skills/spec-driven/SKILL.md`,
    `    • skills/inject-guidelines/SKILL.md`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    '',
    `  ${chalk.bold('Google Antigravity CLI (AGY)')} (${formatDir(antigravityCliDir)}):`,
    `    • skills/spec-driven/SKILL.md`,
    `    • skills/inject-guidelines/SKILL.md`,
    `    • skills/${STEROIDS_SKILL_DIRS.join('/, skills/')}/`,
    ''
  ];

  return lines.join('\n');
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function removeCodexLegacyCommands(codexDir: string): Promise<void> {
  await Promise.all([
    fs.remove(path.join(codexDir, 'commands', 'spec-driven.md')),
    fs.remove(path.join(codexDir, 'commands', 'inject-guidelines.md'))
  ]);
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
    if (!await fs.pathExists(subDirPath)) {
      continue;
    }
    const remaining = await fs.readdir(subDirPath).catch(() => []);
    if (remaining.length === 0) {
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
    await removeSteroidsFiles(getGitHubCopilotCliGlobalConfigDir());
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

async function removeQwenCodeGlobalFiles(): Promise<void> {
  const qwenDir = path.join(os.homedir(), '.qwen');
  const agentsDir = path.join(qwenDir, 'agents');
  const commandsDir = path.join(qwenDir, 'commands');
  const skillsDir = path.join(qwenDir, 'skills');

  const agentsFiles = [
    path.join(agentsDir, 'spec-driven.agent.md')
  ];
  const commandsFiles = [
    path.join(commandsDir, 'spec-driven.md'),
    path.join(commandsDir, 'inject-guidelines.md')
  ];
  const skillsFiles = [
    path.join(skillsDir, 'spec-driven.md'),
    path.join(skillsDir, 'inject-guidelines.md')
  ];

  for (const file of [...agentsFiles, ...commandsFiles, ...skillsFiles]) {
    if (await fs.pathExists(file)) {
      await fs.remove(file);
    }
  }
}

async function removeQwenCodeSteroids(): Promise<boolean> {
  try {
    await removeQwenCodeGlobalFiles();
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.qwen'));
    console.log(chalk.green('  ✅ Qwen Code cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Qwen Code: ${err}`));
    return false;
  }
}

async function removeQoderGlobalFiles(): Promise<void> {
  const qoderDir = path.join(os.homedir(), '.qoder');
  const filesToRemove = [
    path.join(qoderDir, 'agents', 'spec-driven.md'),
    path.join(qoderDir, 'commands', 'spec-driven.md'),
    path.join(qoderDir, 'commands', 'inject-guidelines.md')
  ];

  for (const file of filesToRemove) {
    if (await fs.pathExists(file)) {
      await fs.remove(file);
    }
  }

  for (const dir of ['agents', 'commands']) {
    const dirPath = path.join(qoderDir, dir);
    const remaining = await fs.readdir(dirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(dirPath);
    }
  }
}

async function removeQoderSteroids(): Promise<boolean> {
  try {
    await removeQoderGlobalFiles();
    await removeSteroidsSkillDirs(path.join(os.homedir(), '.qoder'));
    console.log(chalk.green('  ✅ Qoder CLI / IDE cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Qoder CLI / IDE: ${err}`));
    return false;
  }
}

async function removeClineSteroids(): Promise<boolean> {
  try {
    const clineDir = path.join(os.homedir(), '.cline');

    // Remove legacy agents/commands files (from older injections)
    await removeSteroidsFiles(clineDir);

    // Remove standard skill dirs (the 12 universal skills)
    await removeSteroidsSkillDirs(clineDir);

    // Remove Cline-specific skill dirs (agent and commands emitted as skills)
    const skillsDir = path.join(clineDir, 'skills');
    for (const skill of CLINE_EXTRA_SKILL_DIRS) {
      const skillPath = path.join(skillsDir, skill);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
      }
    }
    const remaining = await fs.readdir(skillsDir).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(skillsDir);
    }

    console.log(chalk.green('  ✅ Cline cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Cline: ${err}`));
    return false;
  }
}

async function removeAntigravityIdeSteroids(): Promise<boolean> {
  try {
    const antigravityIdeDir = path.join(os.homedir(), '.gemini', 'config');

    await removeSteroidsFiles(antigravityIdeDir);
    await removeSteroidsSkillDirs(antigravityIdeDir);

    const skillsDir = path.join(antigravityIdeDir, 'skills');
    for (const skill of ANTIGRAVITY_EXTRA_SKILL_DIRS) {
      const skillPath = path.join(skillsDir, skill);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
      }
    }
    const remaining = await fs.readdir(skillsDir).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(skillsDir);
    }

    console.log(chalk.green('  ✅ Google Antigravity IDE cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Google Antigravity IDE: ${err}`));
    return false;
  }
}

async function removeAntigravityCliSteroids(): Promise<boolean> {
  try {
    const antigravityCliDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');

    await removeSteroidsFiles(antigravityCliDir);
    await removeSteroidsSkillDirs(antigravityCliDir);

    const skillsDir = path.join(antigravityCliDir, 'skills');
    for (const skill of ANTIGRAVITY_EXTRA_SKILL_DIRS) {
      const skillPath = path.join(skillsDir, skill);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
      }
    }
    const remaining = await fs.readdir(skillsDir).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(skillsDir);
    }

    console.log(chalk.green('  ✅ Google Antigravity CLI (AGY) cleaned.'));
    return true;
  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Google Antigravity CLI (AGY): ${err}`));
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
  const remaining = await fs.readdir(skillsDir).catch(() => []);
  if (remaining.length === 0) {
    await fs.remove(skillsDir);
  }
}
