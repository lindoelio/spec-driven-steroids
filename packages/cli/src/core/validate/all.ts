import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';

import { verifySpec } from './spec.js';

interface SpecSummary {
  slug: string;
  valid: boolean;
  lane: 'brief' | 'full';
  errors: number;
  warnings: number;
}

interface SpecSelection {
  slugs: string[];
  filtered: boolean;
  error?: string;
  warning?: string;
}

function readAllSpecSlugs(targetDir: string): string[] {
  try {
    return fs.readdirSync(path.join(targetDir, '.specs', 'changes'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function selectSpecSlugs(targetDir: string, changedRef?: string): SpecSelection {
  if (!changedRef) {
    return { slugs: readAllSpecSlugs(targetDir), filtered: false };
  }

  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${changedRef}^{commit}`], {
      cwd: targetDir,
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        slugs: readAllSpecSlugs(targetDir),
        filtered: false,
        warning: 'git is not available; validating all specs instead of changed specs.'
      };
    }
    return {
      slugs: [],
      filtered: true,
      error: `Cannot resolve git ref '${changedRef}'. Ensure the ref exists and the target is a git repository; shallow clones may need a full fetch (fetch-depth: 0).`
    };
  }

  try {
    const output = execFileSync('git', ['diff', '--name-only', `${changedRef}...HEAD`], {
      cwd: targetDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const slugs = new Set<string>();
    for (const line of output.split('\n')) {
      const match = line.match(/^\.specs\/changes\/([^/]+)\//);
      if (match) slugs.add(match[1]);
    }
    return { slugs: [...slugs].sort(), filtered: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        slugs: readAllSpecSlugs(targetDir),
        filtered: false,
        warning: 'git is not available; validating all specs instead of changed specs.'
      };
    }
    return {
      slugs: [],
      filtered: true,
      error: `Unable to diff against git ref '${changedRef}'. A shallow clone may be missing the merge base; fetch the ref with full history.`
    };
  }
}

export function createAllCommand(): Command {
  const cmd = new Command();

  cmd
    .name('all')
    .description('Validate all specs under .specs/changes in one aggregated result')
    .option('--target-dir <path>', 'Project root directory', process.cwd())
    .option('--changed <ref>', 'Only validate specs changed since a git ref')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (opts: { targetDir: string; changed?: string; format: string }) => {
      const selection = selectSpecSlugs(opts.targetDir, opts.changed);

      if (selection.warning) {
        console.error(chalk.yellow(`Warning: ${selection.warning}`));
      }

      if (selection.error) {
        if (opts.format === 'json') {
          console.log(JSON.stringify({ valid: false, specs: [], error: selection.error }, null, 2));
        } else {
          console.error(chalk.red(`Error: ${selection.error}`));
        }
        process.exitCode = 2;
        return;
      }

      const slugs = selection.slugs;

      if (slugs.length === 0) {
        const message = selection.filtered
          ? `No spec changes detected since '${opts.changed}'.`
          : 'No specs found under .specs/changes.';
        if (opts.format === 'json') {
          console.log(JSON.stringify({ valid: true, specs: [], message }, null, 2));
        } else {
          console.log(chalk.yellow(message));
        }
        process.exitCode = 0;
        return;
      }

      const summaries: SpecSummary[] = [];
      for (const slug of slugs) {
        const result = await verifySpec(slug, opts.targetDir);
        summaries.push({
          slug,
          valid: result.valid,
          lane: result.lane,
          errors: result.errors.length,
          warnings: result.warnings.length
        });
      }

      const valid = summaries.every(summary => summary.valid);

      if (opts.format === 'json') {
        console.log(JSON.stringify({ valid, specs: summaries }, null, 2));
      } else {
        for (const summary of summaries) {
          const status = summary.valid ? chalk.green('PASS') : chalk.red('FAIL');
          console.log(`${status} ${summary.slug} (${summary.lane}, ${summary.errors} errors, ${summary.warnings} warnings)`);
        }
        console.log(valid ? chalk.green('\nAll specs passed.') : chalk.red('\nSome specs failed.'));
      }

      process.exitCode = valid ? 0 : 1;
    });

  return cmd;
}
