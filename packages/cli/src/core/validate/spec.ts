import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import {
  ValidationResult,
  createValidationResult,
  formatValidationResult,
  getExitCode,
  ValidationError
} from './shared/formatter.js';
import { extractDeclaredDesignElementIds } from './shared/ids.js';
import { verifyDesignFile } from './design.js';
import { verifyTasksFile } from './tasks.js';
import { verifyRequirementsFile } from './requirements.js';
import { verifySpecStructure } from './structure.js';

const SKILL_DOCS = {
  requirements: 'skills/spec-driven-requirements-writer/SKILL.md',
  design: 'skills/spec-driven-technical-designer/SKILL.md',
  tasks: 'skills/spec-driven-task-decomposer/SKILL.md'
} as const;

interface SpecValidationResult extends ValidationResult {
  requirementsErrors: string[];
  designErrors: string[];
  tasksErrors: string[];
  traceabilityReport: {
    complete: boolean;
    orphans: string[];
    circular: string[];
  };
}

async function verifyCompleteSpec(slug: string, targetDir: string): Promise<SpecValidationResult> {
  const errors: ValidationError[] = [];
  const requirementsErrors: string[] = [];
  const designErrors: string[] = [];
  const tasksErrors: string[] = [];
  
  const specDir = path.join(targetDir, '.specs', 'changes', slug);
  
  const structureResult = await verifySpecStructure(slug, targetDir);
  if (!structureResult.valid) {
    for (const err of structureResult.errors) {
      errors.push(err);
    }
  }
  
  if (structureResult.unexpectedFiles.length > 0) {
    errors.push({
      errorType: 'Structure Error',
      context: `Unexpected files found: ${structureResult.unexpectedFiles.join(', ')}`,
      message: `Unexpected files found`,
      suggestedFix: 'Only requirements.md, design.md, and tasks.md are allowed. Remove or rename extra files'
    });
  }
  
  let requirementsContent = '';
  let designContent = '';
  let tasksContent = '';
  
  try {
    requirementsContent = fs.readFileSync(path.join(specDir, 'requirements.md'), 'utf-8');
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
    designContent = fs.readFileSync(path.join(specDir, 'design.md'), 'utf-8');
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
    tasksContent = fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf-8');
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
    if (!reqResult.valid) {
      for (const err of reqResult.errors) {
        requirementsErrors.push(err.context || err.message || 'Unknown error');
        errors.push({ ...err, context: `requirements.md: ${err.context || err.message || 'Unknown error'}` });
      }
    }
  }
  
  if (designContent) {
    const desResult = verifyDesignFile(designContent, requirementsContent);
    if (!desResult.valid) {
      for (const err of desResult.errors) {
        designErrors.push(err.context || err.message || 'Unknown error');
        errors.push({ ...err, context: `design.md: ${err.context || err.message || 'Unknown error'}` });
      }
    }
  }
  
  if (tasksContent) {
    const taskResult = verifyTasksFile(tasksContent, designContent, requirementsContent);
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
    ...createValidationResult(errors.length === 0, errors, []),
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

export { verifyCompleteSpec };

export function createSpecCommand(): Command {
  const cmd = new Command();
  
  cmd
    .name('spec')
    .description('Validate a complete spec (requirements, design, tasks) with cross-file traceability')
    .argument('<slug>', 'Spec slug (e.g., my-feature)')
    .option('--target-dir <path>', 'Project root directory', process.cwd())
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (slug: string, opts: { targetDir: string; format: string }) => {
      const result = await verifyCompleteSpec(slug, opts.targetDir);
      
      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
        process.exit(getExitCode(result));
      }
      
      if (!result.valid) {
        console.log(chalk.red('❌ Spec validation failed:\n'));
        
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
        
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Spec validation passed.'));
      console.log('\nTraceability Report:');
      console.log(`  Complete: ${result.traceabilityReport.complete ? 'Yes' : 'No'}`);
      if (result.traceabilityReport.orphans.length > 0) {
        console.log(chalk.yellow(`  Orphaned design elements: ${result.traceabilityReport.orphans.join(', ')}`));
      }
      
      process.exit(0);
    });
  
  return cmd;
}
