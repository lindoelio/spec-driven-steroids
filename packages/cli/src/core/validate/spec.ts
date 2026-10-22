import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import {
  ValidationResult,
  createValidationResult,
  formatValidationResult,
  getExitCode,
  ValidationError,
  ValidationWarning
} from './shared/formatter.js';
import { extractDeclaredDesignElementIds } from './shared/ids.js';
import { verifyDesignFile } from './design.js';
import { verifyTasksFile } from './tasks.js';
import { verifyRequirementsFile } from './requirements.js';
import { verifyBriefFile } from './brief.js';
import { verifySpecStructure } from './structure.js';

const SKILL_DOCS = {
  requirements: 'skills/spec-driven-requirements-writer/SKILL.md',
  design: 'skills/spec-driven-technical-designer/SKILL.md',
  tasks: 'skills/spec-driven-task-decomposer/SKILL.md'
} as const;

interface SpecValidationResult extends ValidationResult {
  lane: 'brief' | 'full';
  briefErrors: string[];
  requirementsErrors: string[];
  designErrors: string[];
  tasksErrors: string[];
  traceabilityReport: {
    complete: boolean;
    orphans: string[];
    circular: string[];
  };
}

type StructureValidationResult = Awaited<ReturnType<typeof verifySpecStructure>>;

async function verifyCompleteSpec(
  slug: string,
  targetDir: string,
  prevalidatedStructure?: StructureValidationResult
): Promise<SpecValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const briefErrors: string[] = [];
  const requirementsErrors: string[] = [];
  const designErrors: string[] = [];
  const tasksErrors: string[] = [];

  const specDir = path.join(targetDir, '.specs', 'changes', slug);

  const structureResult = prevalidatedStructure ?? await verifySpecStructure(slug, targetDir);
  warnings.push(...structureResult.warnings);
  if (!structureResult.valid) {
    for (const err of structureResult.errors) {
      errors.push(err);
    }
  }

  let requirementsContent = '';
  let designContent = '';
  let tasksContent = '';

  try {
    requirementsContent = await fs.readFile(path.join(specDir, 'requirements.md'), 'utf-8');
  } catch (e) {
    const errMsg = `Cannot read requirements.md: ${(e as Error).message}`;
    requirementsErrors.push(errMsg);
    errors.push({
      errorType: 'File Error',
      context: errMsg,
      suggestedFix: 'Ensure file exists in .specs/changes/{slug}/ directory',
      skillDocLink: SKILL_DOCS.requirements
    });
  }

  try {
    designContent = await fs.readFile(path.join(specDir, 'design.md'), 'utf-8');
  } catch (e) {
    const errMsg = `Cannot read design.md: ${(e as Error).message}`;
    designErrors.push(errMsg);
    errors.push({
      errorType: 'File Error',
      context: errMsg,
      suggestedFix: 'Ensure file exists in .specs/changes/{slug}/ directory',
      skillDocLink: SKILL_DOCS.design
    });
  }

  try {
    tasksContent = await fs.readFile(path.join(specDir, 'tasks.md'), 'utf-8');
  } catch (e) {
    const errMsg = `Cannot read tasks.md: ${(e as Error).message}`;
    tasksErrors.push(errMsg);
    errors.push({
      errorType: 'File Error',
      context: errMsg,
      suggestedFix: 'Ensure file exists in .specs/changes/{slug}/ directory',
      skillDocLink: SKILL_DOCS.tasks
    });
  }

  if (requirementsContent) {
    const reqResult = verifyRequirementsFile(requirementsContent);
    warnings.push(...reqResult.warnings.map(warning => ({ ...warning, message: `requirements.md: ${warning.message}` })));
    if (!reqResult.valid) {
      for (const err of reqResult.errors) {
        requirementsErrors.push(err.context || err.message || 'Unknown error');
        errors.push({ ...err, context: `requirements.md: ${err.context || err.message || 'Unknown error'}` });
      }
    }
  }

  if (designContent) {
    const desResult = verifyDesignFile(designContent, requirementsContent);
    warnings.push(...desResult.warnings.map(warning => ({ ...warning, message: `design.md: ${warning.message}` })));
    if (!desResult.valid) {
      for (const err of desResult.errors) {
        designErrors.push(err.context || err.message || 'Unknown error');
        errors.push({ ...err, context: `design.md: ${err.context || err.message || 'Unknown error'}` });
      }
    }
  }

  if (tasksContent) {
    const taskResult = verifyTasksFile(tasksContent, designContent, requirementsContent);
    warnings.push(...taskResult.warnings.map(warning => ({ ...warning, message: `tasks.md: ${warning.message}` })));
    if (!taskResult.valid) {
      for (const err of taskResult.errors) {
        tasksErrors.push(err.context || err.message || 'Unknown error');
        errors.push({ ...err, context: `tasks.md: ${err.context || err.message || 'Unknown error'}` });
      }
    }
  }

  const desIds = designContent ? extractDeclaredDesignElementIds(designContent).map(id => id) : [];
  const taskDesImpl = tasksContent
    ? Array.from(tasksContent.matchAll(/_Implements:\s*([^_\n]+)_/gi), m => m[1].match(/DES-\d+/g) || []).flat()
    : [];
  const orphans: string[] = [];

  for (const desId of desIds) {
    const hasTask = taskDesImpl.includes(desId);
    if (!hasTask) {
      orphans.push(desId);
      errors.push({
        errorType: 'Traceability Error',
        context: `${desId} has no implementation task`,
        suggestedFix: `Add a task with _Implements: ${desId}_`,
        skillDocLink: SKILL_DOCS.tasks
      });
    }
  }

  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    lane: 'full',
    briefErrors,
    requirementsErrors,
    designErrors,
    tasksErrors,
    traceabilityReport: {
      complete: orphans.length === 0,
      orphans,
      circular: []
    }
  };
}

async function verifyBriefSpec(
  slug: string,
  targetDir: string,
  prevalidatedStructure?: StructureValidationResult
): Promise<SpecValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const briefErrors: string[] = [];
  const specDir = path.join(targetDir, '.specs', 'changes', slug);
  const structureResult = prevalidatedStructure ?? await verifySpecStructure(slug, targetDir);

  errors.push(...structureResult.errors);
  warnings.push(...structureResult.warnings);

  let briefContent = '';
  try {
    briefContent = await fs.readFile(path.join(specDir, 'brief.md'), 'utf-8');
  } catch (error) {
    const message = `Cannot read brief.md: ${(error as Error).message}`;
    briefErrors.push(message);
    errors.push({
      errorType: 'File Error',
      context: message,
      suggestedFix: 'Ensure brief.md exists in .specs/changes/{slug}/',
      skillDocLink: 'skills/spec-driven-brief-planner/SKILL.md'
    });
  }

  if (briefContent) {
    const result = verifyBriefFile(briefContent);
    warnings.push(...result.warnings.map(warning => ({ ...warning, message: `brief.md: ${warning.message}` })));
    for (const error of result.errors) {
      const message = error.context || error.message || 'Unknown error';
      briefErrors.push(message);
      errors.push({ ...error, context: `brief.md: ${message}` });
    }
  }

  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    lane: 'brief',
    briefErrors,
    requirementsErrors: [],
    designErrors: [],
    tasksErrors: [],
    traceabilityReport: {
      complete: errors.length === 0,
      orphans: [],
      circular: []
    }
  };
}

async function verifySpec(slug: string, targetDir: string): Promise<SpecValidationResult> {
  const structureResult = await verifySpecStructure(slug, targetDir);
  return structureResult.lane === 'brief'
    ? verifyBriefSpec(slug, targetDir, structureResult)
    : verifyCompleteSpec(slug, targetDir, structureResult);
}

export { verifyBriefSpec, verifyCompleteSpec, verifySpec };

export function createSpecCommand(): Command {
  const cmd = new Command();

  cmd
    .name('spec')
    .description('Validate a brief or full spec with cross-file traceability')
    .argument('<slug>', 'Spec slug (e.g., my-feature)')
    .option('--target-dir <path>', 'Project root directory', process.cwd())
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (slug: string, opts: { targetDir: string; format: string }) => {
      const result = await verifySpec(slug, opts.targetDir);

      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
        process.exitCode = getExitCode(result);
        return;
      }

      if (!result.valid) {
        console.log(chalk.red('❌ Spec validation failed:\n'));

        if (result.briefErrors.length > 0) {
          console.log(chalk.red('Brief errors:'));
          for (const err of result.briefErrors) {
            console.log(`  • ${err}`);
          }
          console.log();
        }

        if (result.requirementsErrors.length > 0) {
          console.log(chalk.red('Requirements errors:'));
          for (const err of result.requirementsErrors) {
            console.log(`  • ${err}`);
          }
          console.log();
        }

        if (result.designErrors.length > 0) {
          console.log(chalk.red('Design errors:'));
          for (const err of result.designErrors) {
            console.log(`  • ${err}`);
          }
          console.log();
        }

        if (result.tasksErrors.length > 0) {
          console.log(chalk.red('Tasks errors:'));
          for (const err of result.tasksErrors) {
            console.log(`  • ${err}`);
          }
          console.log();
        }

        process.exitCode = 1;

        return;
      }

      console.log(chalk.green('✅ Spec validation passed.'));
      console.log(`\nLane: ${result.lane}`);
      console.log('\nTraceability Report:');
      console.log(`  Complete: ${result.traceabilityReport.complete ? 'Yes' : 'No'}`);
      if (result.traceabilityReport.orphans.length > 0) {
        console.log(chalk.yellow(`  Orphaned design elements: ${result.traceabilityReport.orphans.join(', ')}`));
      }
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const warning of result.warnings) {
          console.log(`  • ${warning.message}`);
        }
      }

      process.exitCode = 0;

      return;
    });

  return cmd;
}
