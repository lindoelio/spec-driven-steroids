import { Command } from 'commander';
import { createStructureCommand } from './structure.js';
import { createRequirementsCommand } from './requirements.js';
import { createDesignCommand } from './design.js';
import { createTasksCommand } from './tasks.js';
import { createSpecCommand } from './spec.js';

/**
 * Creates the parent 'validate' command with all subcommands registered.
 * Provides comprehensive validation for Spec-Driven specs:
 * - structure: Validates spec directory structure
 * - requirements: Validates requirements.md EARS patterns and numbering
 * - design: Validates design.md Mermaid diagrams and traceability
 * - tasks: Validates tasks.md phase structure and traceability
 * - spec: Validates entire spec with cross-file traceability
 */
export function createValidateCommand(): Command {
  const cmd = new Command();

  cmd
    .name('validate')
    .description(
      `Validate Spec-Driven specs for correctness and completeness.

The validate command checks specs in .specs/changes/<slug>/ for:
  • structure   - Required files (requirements.md, design.md, tasks.md)
  • requirements - EARS patterns, REQ-X numbering, acceptance criteria
  • design      - Mermaid diagrams, DES-X numbering, _Implements tags
  • tasks       - Phase structure, task status, traceability links
  • spec        - Cross-file validation and traceability matrix

All subcommands support --format <text|json> for output control.
Use --help with any subcommand for specific options and examples.`
    )
    .addCommand(createStructureCommand())
    .addCommand(createRequirementsCommand())
    .addCommand(createDesignCommand())
    .addCommand(createTasksCommand())
    .addCommand(createSpecCommand());

  return cmd;
}

export default createValidateCommand;