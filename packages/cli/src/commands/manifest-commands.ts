import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';

import {
  buildInstalledFiles,
  cleanManifest,
  collectFiles,
  hashFile,
  listManifests,
  writeManifest,
  type InstallManifest
} from '../cli/install-manifest.js';
import { getPlatformDefinition } from '../cli/platform-registry.js';
import { resolveTemplateSource } from '../cli/template-source.js';
import { transformTemplates } from '../cli/transformation-pipeline.js';
import { flattenPromptFiles, resolveFlattenedPromptPaths } from '../cli/vscode-prompts.js';
import { getBundledTemplatesDir, getCliVersion } from '../cli/version.js';

type ScopeFilter = 'global' | 'project';

function filterManifests(
  manifests: InstallManifest[],
  options: { platform?: string; scope: ScopeFilter; projectRoot?: string }
): InstallManifest[] {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  return manifests.filter(manifest => {
    if (manifest.scope !== options.scope) return false;
    if (options.platform && manifest.platform !== options.platform) return false;
    if (options.scope === 'project') {
      const manifestRoot = path.resolve(manifest.root);
      return manifestRoot === projectRoot || manifestRoot.startsWith(`${projectRoot}${path.sep}`);
    }
    return true;
  });
}

export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Check installed SDS files for missing or modified artifacts')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (opts: { format: string }) => {
      const manifests = await listManifests();
      const report: Array<{
        platform: string;
        scope: string;
        root: string;
        missing: string[];
        modified: string[];
        ok: number;
      }> = [];

      for (const manifest of manifests) {
        const missing: string[] = [];
        const modified: string[] = [];
        let ok = 0;

        for (const file of manifest.files) {
          if (!await fs.pathExists(file.path)) {
            missing.push(file.path);
            continue;
          }
          const digest = await hashFile(file.path);
          if (digest !== file.sha256) {
            modified.push(file.path);
          } else {
            ok += 1;
          }
        }

        report.push({
          platform: manifest.platform,
          scope: manifest.scope,
          root: manifest.root,
          missing,
          modified,
          ok
        });
      }

      const healthy = report.every(entry => entry.missing.length === 0 && entry.modified.length === 0);
      if (opts.format === 'json') {
        console.log(JSON.stringify({ healthy, installs: report }, null, 2));
      } else if (report.length === 0) {
        console.log(chalk.yellow('No SDS install manifests found.'));
      } else {
        for (const entry of report) {
          const status = entry.missing.length === 0 && entry.modified.length === 0
            ? chalk.green('OK')
            : chalk.yellow('DRIFT');
          console.log(`${status} ${entry.platform} (${entry.scope}) ${entry.root}`);
          if (entry.missing.length > 0) {
            console.log(chalk.red(`  missing: ${entry.missing.length}`));
            for (const file of entry.missing.slice(0, 5)) console.log(`    - ${file}`);
          }
          if (entry.modified.length > 0) {
            console.log(chalk.yellow(`  modified: ${entry.modified.length}`));
            for (const file of entry.modified.slice(0, 5)) console.log(`    - ${file}`);
          }
        }
      }

      process.exitCode = healthy ? 0 : 1;
    });
}

export function createUninstallCommand(): Command {
  return new Command('uninstall')
    .description('Remove manifest-tracked SDS files for a platform and scope')
    .option('--platform <platform>', 'Limit to one platform')
    .option('--scope <scope>', 'Scope: global or project', 'global')
    .option('--project', 'Shortcut for --scope project')
    .option('--force', 'Remove files even if modified')
    .option('--dry-run', 'Show what would be removed')
    .option('--json', 'Emit JSON')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (opts: {
      platform?: string;
      scope?: string;
      project?: boolean;
      force?: boolean;
      dryRun?: boolean;
      json?: boolean;
      yes?: boolean;
    }) => {
      const scope: ScopeFilter = opts.project || opts.scope === 'project' ? 'project' : 'global';
      const manifests = filterManifests(await listManifests(), {
        platform: opts.platform,
        scope,
        projectRoot: process.cwd()
      });

      if (manifests.length === 0) {
        if (opts.json) console.log(JSON.stringify({ scope, removed: [], skipped: [], manifests: 0 }, null, 2));
        else console.log(chalk.yellow(`No ${scope} install manifests found.`));
        return;
      }

      if (!opts.yes && !opts.dryRun) {
        const { confirmed } = await inquirer.prompt([
          { type: 'confirm', name: 'confirmed', message: `Remove ${manifests.length} install(s)?`, default: false }
        ]);
        if (!confirmed) {
          console.log(chalk.yellow('Aborted.'));
          return;
        }
      }

      const removed: string[] = [];
      const skipped: string[] = [];
      for (const manifest of manifests) {
        const result = await cleanManifest(manifest, { force: opts.force, dryRun: opts.dryRun });
        removed.push(...result.removed);
        skipped.push(...result.skipped);
      }

      if (opts.json) {
        console.log(JSON.stringify({ scope, manifests: manifests.length, removed, skipped, dryRun: opts.dryRun === true }, null, 2));
      } else {
        console.log(chalk.green(`Removed ${removed.length} file(s) from ${manifests.length} install(s).`));
        if (skipped.length > 0) {
          console.log(chalk.yellow(`Skipped ${skipped.length} modified file(s). Use --force to remove them.`));
        }
      }

      if (skipped.length > 0) process.exitCode = 1;
    });
}

export function createRepairCommand(): Command {
  return new Command('repair')
    .description('Re-inject missing files for manifest-tracked installs')
    .option('--platform <platform>', 'Limit to one platform')
    .option('--scope <scope>', 'Scope: global or project', 'global')
    .option('--project', 'Shortcut for --scope project')
    .option('--dry-run', 'Show what would be written')
    .option('--json', 'Emit JSON')
    .action(async (opts: {
      platform?: string;
      scope?: string;
      project?: boolean;
      dryRun?: boolean;
      json?: boolean;
    }) => {
      const scope: ScopeFilter = opts.project || opts.scope === 'project' ? 'project' : 'global';
      const manifests = filterManifests(await listManifests(), {
        platform: opts.platform,
        scope,
        projectRoot: process.cwd()
      });

      if (manifests.length === 0) {
        if (opts.json) console.log(JSON.stringify({ scope, repaired: [], manifests: 0 }, null, 2));
        else console.log(chalk.yellow(`No ${scope} install manifests found.`));
        return;
      }

      const templateSource = await resolveTemplateSource({
        bundledTemplatesDir: getBundledTemplatesDir(),
        cliVersion: getCliVersion()
      });
      const universalSkillsDir = path.join(templateSource.rootDir, 'universal/skills');
      const repaired: Array<{ platform: string; scope: string; files: number; ok: boolean; error?: string }> = [];

      for (const manifest of manifests) {
        const definition = getPlatformDefinition(manifest.platform);
        if (!definition) {
          repaired.push({ platform: manifest.platform, scope: manifest.scope, files: 0, ok: false, error: 'Unknown platform' });
          continue;
        }

        try {
          const skipOutputTypes = manifest.platform === 'github-vscode' && manifest.scope === 'global'
            ? definition.skipOutputTypes
            : undefined;
          const results = await transformTemplates(
            [manifest.platform],
            templateSource.rootDir,
            () => manifest.root,
            { skipOutputTypes, dryRun: opts.dryRun }
          );
          const failures = results.filter(result => !result.success);
          if (failures.length > 0) {
            throw new Error(failures.map(result => `${result.sourcePath}: ${result.error ?? 'unknown error'}`).join('; '));
          }

          const transformedFiles = results
            .map(result => result.outputPath)
            .filter((outputPath): outputPath is string => outputPath.length > 0);
          const flattensPrompts = definition.postProcess === 'flatten-vscode-prompts' && manifest.scope === 'global';
          const writtenFiles = flattensPrompts
            ? resolveFlattenedPromptPaths(manifest.root, transformedFiles)
            : transformedFiles;
          const skillFiles = (await collectFiles(universalSkillsDir))
            .map(file => path.join(manifest.skillsRoot, path.relative(universalSkillsDir, file)));

          if (!opts.dryRun) {
            await fs.ensureDir(manifest.skillsRoot);
            await fs.copy(universalSkillsDir, manifest.skillsRoot, { overwrite: true });
            if (flattensPrompts) {
              await flattenPromptFiles(manifest.root, transformedFiles);
            }
            if (definition.postProcess === 'remove-codex-legacy-commands') {
              await fs.remove(path.join(manifest.root, 'commands', 'spec-driven.md'));
              await fs.remove(path.join(manifest.root, 'commands', 'inject-guidelines.md'));
            }

            const installedFiles = await buildInstalledFiles([...writtenFiles, ...skillFiles]);
            await writeManifest({
              ...manifest,
              cliVersion: getCliVersion(),
              templateVersion: templateSource.version,
              installedAt: new Date().toISOString(),
              files: installedFiles
            });
          }

          repaired.push({ platform: manifest.platform, scope: manifest.scope, files: writtenFiles.length + skillFiles.length, ok: true });
        } catch (error) {
          repaired.push({
            platform: manifest.platform,
            scope: manifest.scope,
            files: 0,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const healthy = repaired.every(entry => entry.ok);
      if (opts.json) {
        console.log(JSON.stringify({ scope, dryRun: opts.dryRun === true, repaired }, null, 2));
      } else {
        for (const entry of repaired) {
          const status = entry.ok ? chalk.green('OK') : chalk.red('FAIL');
          console.log(`${status} ${entry.platform} (${entry.scope}) ${entry.files} file(s)`);
          if (entry.error) console.log(chalk.red(`  ${entry.error}`));
        }
      }
      process.exitCode = healthy ? 0 : 1;
    });
}

export function createTemplatesCommand(): Command {
  return new Command('templates')
    .description('Inspect the resolved template source')
    .argument('<action>', 'Action: info')
    .option('--source <source>', 'Template source: bundled or remote')
    .option('--json', 'Emit JSON')
    .action(async (action: string, opts: { source?: string; json?: boolean }) => {
      if (action !== 'info') {
        console.error(chalk.red(`Error: Unknown templates action '${action}'. Use 'info'.`));
        process.exitCode = 2;
        return;
      }

      const resolution = await resolveTemplateSource({
        bundledTemplatesDir: getBundledTemplatesDir(),
        cliVersion: getCliVersion(),
        source: opts.source as 'bundled' | 'remote' | undefined
      });

      const payload = {
        source: resolution.source,
        version: resolution.version,
        rootDir: resolution.rootDir,
        sha256: resolution.sha256,
        fallbackReason: resolution.fallbackReason,
        warnings: resolution.warnings
      };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(`Source: ${payload.source}`);
        console.log(`Version: ${payload.version}`);
        console.log(`Root: ${payload.rootDir}`);
        if (payload.sha256) console.log(`SHA-256: ${payload.sha256}`);
        if (payload.fallbackReason) console.log(chalk.yellow(`Fallback: ${payload.fallbackReason}`));
        for (const warning of payload.warnings) console.log(chalk.yellow(`Warning: ${warning}`));
      }
    });
}
