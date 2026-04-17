import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import {
  ValidationResult,
  createValidationResult,
  formatValidationResult,
  getExitCode
} from './shared/formatter.js';

const REQUIRED_FILES = ['requirements.md', 'design.md', 'tasks.md'];
const ALLOWED_FILES = [...REQUIRED_FILES];

interface StructureValidationResult extends ValidationResult {
  specDir: string;
  filesFound: string[];
  missingFiles: string[];
  unexpectedFiles: string[];
}

async function verifySpecStructure(slug: string, targetDir: string): Promise<StructureValidationResult> {
  const errors: Array<{ line?: number; errorType: string; context?: string; message: string; suggestedFix?: string }> = [];
  const warnings: Array<{ line?: number; message: string }> = [];
  const specDir = path.join(targetDir, '.specs', 'changes', slug);
  
  let files: string[] = [];
  
  try {
    const stats = await fs.stat(specDir);
    if (!stats.isDirectory()) {
      errors.push({
        errorType: 'Structure Error',
        context: `Path is not a directory: ${specDir}`,
        message: `Path is not a directory`,
        suggestedFix: 'Create spec directory with: mkdir -p .specs/changes/{slug}'
      });
      return {
        ...createValidationResult(false, errors, warnings),
        specDir,
        filesFound: [],
        missingFiles: REQUIRED_FILES,
        unexpectedFiles: []
      };
    }
    files = await fs.readdir(specDir);
  } catch {
    errors.push({
      errorType: 'Structure Error',
      context: `Spec directory does not exist: ${specDir}`,
      message: `Spec directory does not exist`,
      suggestedFix: 'Create spec directory with: mkdir -p .specs/changes/{slug}'
    });
    return {
      ...createValidationResult(false, errors, warnings),
      specDir,
      filesFound: [],
      missingFiles: REQUIRED_FILES,
      unexpectedFiles: []
    };
  }
  
  const missingFiles = REQUIRED_FILES.filter(f => !files.includes(f));
  const unexpectedFiles = files.filter(f => !ALLOWED_FILES.includes(f));
  
  for (const missingFile of missingFiles) {
    errors.push({
      errorType: 'Structure Error',
      context: `Missing required file: ${missingFile}`,
      message: `Missing required file: ${missingFile}`,
      suggestedFix: `Create ${missingFile} in ${specDir}/`
    });
  }
  
  if (unexpectedFiles.length > 0) {
    errors.push({
      errorType: 'Structure Error',
      context: `Unexpected files found: ${unexpectedFiles.join(', ')}`,
      message: `Unexpected files found`,
      suggestedFix: 'Only requirements.md, design.md, and tasks.md are allowed. Remove or rename extra files'
    });
  }
  
  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    specDir,
    filesFound: files,
    missingFiles,
    unexpectedFiles
  };
}

export function createStructureCommand(): Command {
  const cmd = new Command();
  
  cmd
    .name('structure')
    .description('Validate that a spec directory contains the three required files (requirements.md, design.md, tasks.md)')
    .argument('<slug>', 'Spec slug (e.g., my-feature)')
    .option('--target-dir <path>', 'Project root directory', process.cwd())
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (slug: string, opts: { targetDir: string; format: string }) => {
      const result = await verifySpecStructure(slug, opts.targetDir);
      
      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
        process.exit(getExitCode(result));
      }
      
      if (!result.valid) {
        console.log(chalk.red('❌ Structure validation failed:\n'));
        for (const err of result.errors) {
          console.log(`  • ${err.context || err.message}`);
          if (err.suggestedFix) {
            console.log(chalk.gray(`    → ${err.suggestedFix}`));
          }
        }
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Structure validation passed.'));
      console.log(`\nSpec directory: ${result.specDir}`);
      console.log(`Files found: ${result.filesFound.join(', ')}`);
      process.exit(0);
    });
  
  return cmd;
}
