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
  extractRequirementIds
} from './shared/ids.js';
import { detectEarsPatterns } from './shared/ears.js';

const SKILL_DOCS = {
  requirements: 'skills/spec-driven-requirements-writer/SKILL.md',
  design: 'skills/spec-driven-technical-designer/SKILL.md',
  tasks: 'skills/spec-driven-task-decomposer/SKILL.md'
} as const;

interface RequirementsValidationResult extends ValidationResult {
  requirementsFound: string[];
  earsPatterns: string[];
}

function formatError(error: ValidationError): string {
  let message = `[${error.errorType}] → ${error.context || error.message} → ${error.suggestedFix || ''}`;
  if (error.skillDocLink) {
    message += `\n   See: ${error.skillDocLink}`;
  }
  return message;
}

function verifyRequirementsFile(content: string): RequirementsValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Array<{ line?: number; message: string }> = [];
  const requirementsFound: string[] = [];
  const earsPatterns: string[] = [];

  const enforceDocumentSections = content.includes('# Requirements Document');

  if (enforceDocumentSections && !content.includes('## Introduction')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Introduction section not found',
      suggestedFix: 'Add ## Introduction section at top with project background and objectives',
      skillDocLink: SKILL_DOCS.requirements
    });
  }
  if (enforceDocumentSections && !content.includes('## Glossary')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Glossary section not found',
      suggestedFix: 'Add ## Glossary section defining key terms',
      skillDocLink: SKILL_DOCS.requirements
    });
  }
  if (enforceDocumentSections && !content.includes('## Requirements')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Requirements section not found',
      suggestedFix: 'Add ## Requirements section with REQ-X numbering',
      skillDocLink: SKILL_DOCS.requirements
    });
  }

  const reqMatches = extractRequirementIds(content);
  if (reqMatches.length > 0) {
    requirementsFound.push(...reqMatches);
  } else {
    errors.push({
      errorType: 'Format Error',
      context: 'No REQ-X IDs found',
      suggestedFix: 'Number each requirement with REQ-1, REQ-2, etc.',
      skillDocLink: SKILL_DOCS.requirements
    });
  }

  const foundPatterns = detectEarsPatterns(content);
  earsPatterns.push(...foundPatterns);

  if (earsPatterns.length === 0) {
    errors.push({
      errorType: 'Format Error',
      context: 'No EARS patterns detected',
      suggestedFix: 'Use EARS keywords (WHEN, IF, THEN, SHALL, WHILE, WHERE) to structure requirements',
      skillDocLink: SKILL_DOCS.requirements
    });
  }

  const acceptanceCriteriaMatches = content.match(/^\s*\d+(?:\.\d+)?(?:\.)?\s+/gm);
  if (!acceptanceCriteriaMatches || acceptanceCriteriaMatches.length === 0) {
    errors.push({
      errorType: 'Format Error',
      context: 'No 1.1, 1.2, etc. numbering found',
      suggestedFix: 'Add numbered acceptance criteria for each requirement',
      skillDocLink: SKILL_DOCS.requirements
    });
  }

  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    requirementsFound,
    earsPatterns
  };
}

export { verifyRequirementsFile };

export function createRequirementsCommand(): Command {
  const cmd = new Command();
  
  cmd
    .name('requirements')
    .description('Validate a requirements.md file for EARS patterns, REQ-X numbering, and acceptance criteria')
    .argument('<path>', 'Path to requirements.md file')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (filePath: string, opts: { format: string }) => {
      const targetDir = process.cwd();
      const fullPath = path.resolve(targetDir, filePath);
      
      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        console.error(chalk.red(`Error: Cannot read file: ${fullPath}`));
        process.exit(1);
      }
      
      const result = verifyRequirementsFile(content);
      const output = formatValidationResult(result, opts.format as 'text' | 'json');
      
      if (opts.format === 'json') {
        console.log(output);
      } else {
        if (!result.valid) {
          console.log(chalk.red('❌ Requirements validation failed:\n'));
          for (const err of result.errors) {
            console.log(formatError(err));
            console.log();
          }
          process.exit(1);
        } else {
          console.log(chalk.green('✅ Requirements validation passed.'));
          console.log(`\nFound ${result.requirementsFound.length} requirements.`);
          console.log(`EARS patterns: ${result.earsPatterns.join(', ')}`);
        }
      }
      
      process.exit(getExitCode(result));
    });
  
  return cmd;
}
