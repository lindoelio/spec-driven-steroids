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
import {
  extractAcceptanceCriteriaRefs,
  extractDeclaredDesignElementIds,
  findLineNumber
} from './shared/ids.js';
import { stripInlineMarkdown } from './shared/traceability.js';

const SKILL_DOCS = {
  tasks: 'skills/spec-driven-task-decomposer/SKILL.md'
} as const;

interface TasksValidationResult extends ValidationResult {
  tasksFound: number;
  phases: string[];
  traceabilityReport: {
    linked: string[];
    missingTraces: string[];
  };
}

function formatError(error: ValidationError): string {
  let message = `[${error.errorType}] → ${error.context || error.message} → ${error.suggestedFix || ''}`;
  if (error.skillDocLink) {
    message += `\n   See: ${error.skillDocLink}`;
  }
  return message;
}

function verifyTasksFile(content: string, designContent?: string, requirementsContent?: string): TasksValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Array<{ line?: number; message: string }> = [];
  
  if (!content.includes('## Overview')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Overview section not found',
      suggestedFix: 'Add ## Overview section with phases list',
      skillDocLink: SKILL_DOCS.tasks
    });
  }
  
  const phaseMatches = content.match(/^##\s*Phase\s+\d+\s*:[^\n]*/gmi);
  const phases: string[] = [];
  if (!phaseMatches || phaseMatches.length === 0) {
    errors.push({
      errorType: 'Structure Error',
      context: 'No phase headers found',
      suggestedFix: 'Add phase sections using ## Phase 1:, ## Phase 2:, etc.',
      skillDocLink: SKILL_DOCS.tasks
    });
  } else {
    phases.push(...phaseMatches);
    const phaseNumbers = phases.map(phase => Number(phase.match(/^##\s*Phase\s+(\d+)\s*:/i)?.[1]));
    for (let i = 0; i < phaseNumbers.length; i++) {
      if (phaseNumbers[i] !== i + 1) {
        errors.push({
          errorType: 'Structure Error',
          context: `Phase numbering is not contiguous at phase ${phaseNumbers[i]}`,
          suggestedFix: 'Number phases sequentially starting at Phase 1',
          skillDocLink: SKILL_DOCS.tasks
        });
        break;
      }
    }
  }
  
  const hasFinalCheckpoint = phases.some(p => /Final\s+Checkpoint/i.test(stripInlineMarkdown(p)));
  if (phases.length > 1 && !hasFinalCheckpoint) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Final Checkpoint phase not found',
      suggestedFix: 'Add ## Phase X: Final Checkpoint section at end',
      skillDocLink: SKILL_DOCS.tasks
    });
  }
  if (hasFinalCheckpoint && phases.length > 0 && !/Final\s+Checkpoint/i.test(stripInlineMarkdown(phases[phases.length - 1]))) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Final Checkpoint phase is not last',
      suggestedFix: 'Move the Final Checkpoint phase to the end of tasks.md',
      skillDocLink: SKILL_DOCS.tasks
    });
  }
  
  const lines = content.split('\n');
  const taskMatches = content.match(/^- \[[^\]]\]\s+.*$/gm);
  const linked: string[] = [];
  const missingTraces: string[] = [];
  const taskIds = new Set<string>();
  const dependencyRefs: Array<{ ref: string; line: number }> = [];
  const declaredDesIds = designContent ? extractDeclaredDesignElementIds(designContent) : [];
  const validAcceptanceRefs = requirementsContent ? extractAcceptanceCriteriaRefs(requirementsContent) : [];
  
  if (!taskMatches || taskMatches.length === 0) {
    errors.push({
      errorType: 'Structure Error',
      context: 'No tasks in checkbox format found',
      suggestedFix: 'Add tasks with format - [ ] 1.1, - [ ] 1.2, etc.',
      skillDocLink: SKILL_DOCS.tasks
    });
  } else {
    let currentPhaseHeader = '';
    
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      
      if (/^##\s*Phase\s+\d+\s*:/i.test(line)) {
        currentPhaseHeader = line;
      }
      
      const taskMatch = line.match(/^- \[([^\]])\]\s+(.*)$/);
      if (!taskMatch) continue;
      
      const marker = taskMatch[1];
      const taskLabel = taskMatch[2].trim();
      const taskId = taskLabel.match(/\d+\.\d+/)?.[0] || taskLabel;
      const lineNumber = index + 1;
      const taskPhase = taskId.match(/^(\d+)\./)?.[1];
      const currentPhase = currentPhaseHeader.match(/^##\s*Phase\s+(\d+)\s*:/i)?.[1];

      if (taskIds.has(taskId)) {
        errors.push({
          errorType: 'Format Error',
          context: `Duplicate task id: ${taskId}`,
          suggestedFix: 'Use unique task IDs within tasks.md',
          line: lineNumber,
          skillDocLink: SKILL_DOCS.tasks
        });
      }
      taskIds.add(taskId);

      if (taskPhase && currentPhase && taskPhase !== currentPhase) {
        errors.push({
          errorType: 'Format Error',
          context: `Task ${taskId} is under Phase ${currentPhase}`,
          suggestedFix: `Move task ${taskId} to Phase ${taskPhase} or renumber it`,
          line: lineNumber,
          skillDocLink: SKILL_DOCS.tasks
        });
      }
      
      if (![' ', '~', 'x'].includes(marker)) {
        errors.push({
          errorType: 'Format Error',
          context: `Invalid status marker detected: '${marker}'`,
          suggestedFix: 'Use only: [ ] (pending), [~] (in progress), [x] (completed)',
          line: lineNumber,
          skillDocLink: SKILL_DOCS.tasks
        });
      }
      
      if (/Final\s+Checkpoint/i.test(stripInlineMarkdown(currentPhaseHeader))) {
        continue;
      }
      
      const taskBlock: string[] = [line];
      for (let j = index + 1; j < lines.length; j++) {
        if (/^- \[[^\]]\]\s+/.test(lines[j]) || /^##\s*Phase\s+\d+\s*:/i.test(lines[j])) {
          break;
        }
        taskBlock.push(lines[j]);
      }
      
      const taskText = taskBlock.join('\n');
      const dependsMatch = taskText.match(/_Depends:\s*([^_\n]+)_/i);
      if (dependsMatch) {
        const refs = dependsMatch[1].match(/\d+\.\d+/g) || [];
        dependencyRefs.push(...refs.map(ref => ({ ref, line: lineNumber })));
      }

      const traceMatch = taskText.match(/_Implements:\s*([^_\n]+)_/i);
      if (!traceMatch) {
        missingTraces.push(`Line ${lineNumber}: ${taskId}`);
        continue;
      }

      const traceBody = traceMatch[1].trim();
      const desRefs = traceBody.match(/DES-\d+/g) || [];
      const acceptanceRefs = traceBody.match(/REQ-\d+\.\d+/g) || [];
      const isTestTask = /^Test:/i.test(taskLabel.replace(/^\d+\.\d+\s+/, '')) || /Acceptance\s+Criteria\s+Testing/i.test(stripInlineMarkdown(currentPhaseHeader));

      if (isTestTask) {
        if (acceptanceRefs.length === 0) {
          errors.push({
            errorType: 'Traceability Error',
            context: `Test task ${taskId} does not reference an acceptance criterion`,
            suggestedFix: 'Add _Implements: REQ-X.Y_ to each test task',
            line: lineNumber,
            skillDocLink: SKILL_DOCS.tasks
          });
        }
      } else if (desRefs.length === 0) {
        errors.push({
          errorType: 'Traceability Error',
          context: `Implementation task ${taskId} does not reference a design element`,
          suggestedFix: 'Add at least one valid DES-X reference to implementation task traceability',
          line: lineNumber,
          skillDocLink: SKILL_DOCS.tasks
        });
      }

      if (requirementsContent) {
        for (const reqRef of acceptanceRefs) {
          if (!validAcceptanceRefs.includes(reqRef)) {
            errors.push({
              errorType: 'Traceability Error',
              context: `${reqRef} is referenced in tasks but not defined in requirements.md`,
              suggestedFix: `Fix task traceability reference or add ${reqRef} to requirements.md`,
              line: lineNumber,
              skillDocLink: SKILL_DOCS.tasks
            });
          }
        }
      }
       
      linked.push(`${taskId} → ${traceBody}`);
    }
  }
  
  const hasNumberedTaskIds = /- \[[^\]]\]\s+\d+\.\d+\b/.test(content);
  const hasAnyImplementsTags = /_Implements:/i.test(content);
  const traceabilityRequired = hasNumberedTaskIds || hasAnyImplementsTags;
  
  if (traceabilityRequired && missingTraces.length > 0) {
    errors.push({
      errorType: 'Traceability Error',
      context: `Missing traceability links for ${missingTraces.length} task(s)`,
      suggestedFix: 'Add _Implements: DES-X_ (and optional REQ-X.Y) to each non-checkpoint task',
      skillDocLink: SKILL_DOCS.tasks
    });
  }
  
  if (designContent) {
    const desIds = declaredDesIds;
    const implementedDesIds = new Set(
      Array.from(content.matchAll(/_Implements:\s*([^_\n]+)_/gi), (match) => {
        const desRefs = match[1].match(/DES-\d+/g);
        return desRefs || [];
      }).flat()
    );
    
    for (const implementedDesId of implementedDesIds) {
      if (!desIds.includes(implementedDesId)) {
        const line = findLineNumber(content, new RegExp(implementedDesId.replace('.', '\\.'), 'm'));
        errors.push({
          errorType: 'Traceability Error',
          context: `${implementedDesId} is referenced in tasks but not defined in design.md`,
          suggestedFix: `Fix task traceability reference or add ${implementedDesId} to design.md`,
          line: line > 0 ? line : undefined,
          skillDocLink: SKILL_DOCS.tasks
        });
      }
    }
  }

  for (const dependency of dependencyRefs) {
    if (!taskIds.has(dependency.ref)) {
      errors.push({
        errorType: 'Dependency Error',
        context: `_Depends: ${dependency.ref}_ references a missing task`,
        suggestedFix: 'Fix the dependency reference or add the missing task',
        line: dependency.line,
        skillDocLink: SKILL_DOCS.tasks
      });
    }
  }
  
  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    tasksFound: taskMatches?.length || 0,
    phases,
    traceabilityReport: {
      linked,
      missingTraces
    }
  };
}

export { verifyTasksFile };

export function createTasksCommand(): Command {
  const cmd = new Command();
  
  cmd
    .name('tasks')
    .description('Validate a tasks.md file for phase structure, task checkboxes, status markers, and traceability')
    .argument('<path>', 'Path to tasks.md file')
    .option('--design <path>', 'Path to design.md for traceability validation')
    .option('--requirements <path>', 'Path to requirements.md for acceptance-criteria validation')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (filePath: string, opts: { design?: string; requirements?: string; format: string }) => {
      const targetDir = process.cwd();
      const fullPath = path.resolve(targetDir, filePath);
      
      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        console.error(chalk.red(`Error: Cannot read file: ${fullPath}`));
        process.exit(1);
      }
      
      let designContent: string | undefined;
      if (opts.design) {
        const designPath = path.resolve(targetDir, opts.design);
        try {
          designContent = await fs.readFile(designPath, 'utf-8');
        } catch {
          console.error(chalk.red(`Error: Cannot read design file: ${designPath}`));
          process.exit(1);
        }
      }

      let requirementsContent: string | undefined;
      if (opts.requirements) {
        const requirementsPath = path.resolve(targetDir, opts.requirements);
        try {
          requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
        } catch {
          console.error(chalk.red(`Error: Cannot read requirements file: ${requirementsPath}`));
          process.exit(1);
        }
      }
       
      const result = verifyTasksFile(content, designContent, requirementsContent);
      
      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
        process.exit(getExitCode(result));
      }
      
      if (!result.valid) {
        console.log(chalk.red('❌ Tasks validation failed:\n'));
        for (const err of result.errors) {
          console.log(formatError(err));
          console.log();
        }
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Tasks validation passed.'));
      console.log(`\nFound ${result.tasksFound} tasks across ${result.phases.length} phases.`);
      console.log(`Traceability links: ${result.traceabilityReport.linked.length}`);
      process.exit(0);
    });
  
  return cmd;
}
