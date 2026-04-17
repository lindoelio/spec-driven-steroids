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
  extractDesignElementIds,
  extractRequirementIds,
  findLineNumber
} from './shared/ids.js';
import { extractMermaidBlocks, validateMermaidDiagram } from './shared/mermaid.js';
import { buildTraceabilityReport } from './shared/traceability.js';

const SKILL_DOCS = {
  design: 'skills/spec-driven-technical-designer/SKILL.md'
} as const;

interface DesignValidationResult extends ValidationResult {
  traceabilityReport: {
    linked: string[];
    orphaned: string[];
    invalidReqRefs: string[];
  };
  mermaidValidation: {
    valid: boolean;
    errors: Array<{ line: number; errorType: string; message: string }>;
    warnings: Array<{ line?: number; errorType?: string; message: string }>;
    diagramCount: number;
    diagramTypes: string[];
  };
}

function formatError(error: ValidationError): string {
  let message = `[${error.errorType}] → ${error.context || error.message} → ${error.suggestedFix || ''}`;
  if (error.skillDocLink) {
    message += `\n   See: ${error.skillDocLink}`;
  }
  return message;
}

function verifyDesignFile(content: string, requirementsContent?: string): DesignValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Array<{ line?: number; errorType?: string; message: string }> = [];
  
  const enforceDocumentSections = /##\s+(Overview|Code Anatomy|Traceability Matrix)/i.test(content) || content.includes('# Design Document');
  
  if (enforceDocumentSections && !content.includes('## Overview')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Overview section not found',
      suggestedFix: 'Add ## Overview section describing high-level design approach',
      skillDocLink: SKILL_DOCS.design
    });
  }
  if (enforceDocumentSections && !content.includes('## System Architecture')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'System Architecture section not found',
      suggestedFix: 'Add ## System Architecture section with Mermaid diagrams',
      skillDocLink: SKILL_DOCS.design
    });
  }
  if (enforceDocumentSections && !content.includes('## Code Anatomy')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'Code Anatomy section not found',
      suggestedFix: 'Add ## Code Anatomy section with file paths and details',
      skillDocLink: SKILL_DOCS.design
    });
  }
  
  if (!content.includes('```mermaid')) {
    errors.push({
      errorType: 'Structure Error',
      context: 'No Mermaid diagram code blocks found',
      suggestedFix: 'Add Mermaid diagram in ```mermaid ... ``` code blocks',
      skillDocLink: SKILL_DOCS.design
    });
  }
  
  const desIds = extractDesignElementIds(content);
  if (desIds.length === 0) {
    errors.push({
      errorType: 'Format Error',
      context: 'No DES-X design element IDs found',
      suggestedFix: 'Number design elements with DES-1, DES-2, etc.',
      skillDocLink: SKILL_DOCS.design
    });
  }
  
  const reqIds = requirementsContent ? extractRequirementIds(requirementsContent) : [];
  
  const mermaidBlocks = extractMermaidBlocks(content);
  const mermaidErrors: Array<{ line: number; errorType: string; message: string }> = [];
  const mermaidWarnings: Array<{ line?: number; errorType?: string; message: string }> = [];
  const diagramTypes: string[] = [];
  
  for (const block of mermaidBlocks) {
    const result = validateMermaidDiagram(block.content, block.startLine);
    if (!result.valid && result.errors.length > 0) {
      for (const err of result.errors) {
        mermaidErrors.push({
          line: err.line,
          errorType: err.errorType,
          message: err.message
        });
        errors.push({
          errorType: `Mermaid ${err.errorType}`,
          context: `Line ${err.line}: ${err.message}`,
          suggestedFix: err.suggestedFix,
          skillDocLink: SKILL_DOCS.design
        });
      }
    }
    for (const warn of result.warnings) {
      mermaidWarnings.push({
        line: warn.line,
        message: warn.message,
        errorType: 'Mermaid Warning'
      });
    }
    if (result.diagramType) {
      diagramTypes.push(result.diagramType);
    }
  }
  
  const traceReport = buildTraceabilityReport(content, reqIds);
  
  for (const orphan of traceReport.orphaned) {
    const line = findLineNumber(content, new RegExp(`^###\\s+${orphan}\\b`, 'm'));
    errors.push({
      errorType: 'Traceability Error',
      context: `${orphan} has no requirement traceability link`,
      suggestedFix: `Add _Implements: REQ-X.Y_ under ${orphan}`,
      line: line > 0 ? line : undefined,
      skillDocLink: SKILL_DOCS.design
    });
  }
  
  if (enforceDocumentSections && !content.includes('## Traceability Matrix')) {
    warnings.push({
      errorType: 'Structure Warning',
      message: 'Traceability Matrix section not found'
    });
  }
  
  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    traceabilityReport: {
      linked: traceReport.linked,
      orphaned: traceReport.orphaned,
      invalidReqRefs: traceReport.invalidReqRefs
    },
    mermaidValidation: {
      valid: mermaidErrors.length === 0,
      errors: mermaidErrors,
      warnings: mermaidWarnings,
      diagramCount: mermaidBlocks.length,
      diagramTypes
    }
  };
}

export { verifyDesignFile };

export function createDesignCommand(): Command {
  const cmd = new Command();
  
  cmd
    .name('design')
    .description('Validate a design.md file for Mermaid diagrams, DES-X numbering, and traceability links')
    .argument('<path>', 'Path to design.md file')
    .option('--requirements <path>', 'Path to requirements.md for traceability validation')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (filePath: string, opts: { requirements?: string; format: string }) => {
      const targetDir = process.cwd();
      const fullPath = path.resolve(targetDir, filePath);
      
      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        console.error(chalk.red(`Error: Cannot read file: ${fullPath}`));
        process.exit(1);
      }
      
      let requirementsContent: string | undefined;
      if (opts.requirements) {
        const reqPath = path.resolve(targetDir, opts.requirements);
        try {
          requirementsContent = await fs.readFile(reqPath, 'utf-8');
        } catch {
          console.error(chalk.red(`Error: Cannot read requirements file: ${reqPath}`));
          process.exit(1);
        }
      }
      
      const result = verifyDesignFile(content, requirementsContent);
      
      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
        process.exit(getExitCode(result));
      }
      
      if (!result.valid) {
        console.log(chalk.red('❌ Design validation failed:\n'));
        for (const err of result.errors) {
          console.log(formatError(err));
          console.log();
        }
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Design validation passed.'));
      console.log(`\nFound ${result.traceabilityReport.linked.length} traceability links.`);
      if (result.traceabilityReport.orphaned.length > 0) {
        console.log(chalk.yellow(`Warning: ${result.traceabilityReport.orphaned.length} orphaned design elements.`));
      }
      process.exit(0);
    });
  
  return cmd;
}
