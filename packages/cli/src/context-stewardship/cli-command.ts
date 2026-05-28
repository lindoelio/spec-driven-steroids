import { Command } from 'commander';
import chalk from 'chalk';
import { ContextStewardshipOrchestrator } from './orchestrator.js';
import type { Command as OrchCommand } from './orchestrator.js';
import { isStandardDomain } from './domain-taxonomy.js';

export function createStewardshipCommand(): Command {
  const cmd = new Command();

  cmd
    .name('stewardship')
    .description(
      `Manage contextual knowledge for Spec-Driven workflows.

The stewardship command stores, retrieves, and manages architectural decisions,
business rules, and workflow conventions extracted from spec files. These rules
are injected into spec-driven phases to guide agents with established patterns.

Subcommands:
  capabilities   - Report available capabilities
  retrieve       - Search for rules by query and domain
  store          - Persist a new rule
  extract        - Extract decision candidates from spec files
  trace          - Show rule provenance and version history
  inject         - Retrieve context for a spec phase
  manage         - List, deprecate, archive, or move rules

Use --help with any subcommand for specific options and examples.`
    )
    .addCommand(createCapabilitiesCommand())
    .addCommand(createRetrieveCommand())
    .addCommand(createStoreCommand())
    .addCommand(createExtractCommand())
    .addCommand(createTraceCommand())
    .addCommand(createInjectCommand())
    .addCommand(createManageCommand());

  return cmd;
}

function createCapabilitiesCommand(): Command {
  const sub = new Command();

  sub
    .name('capabilities')
    .description('Report available stewardship capabilities')
    .action(async () => {
      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('capabilities' as OrchCommand, {});
      console.log(result.output);
    });

  return sub;
}

function createRetrieveCommand(): Command {
  const sub = new Command();

  sub
    .name('retrieve')
    .description('Search for rules in the knowledge graph')
    .argument('<query>', 'Search query text')
    .option('--domain <domain>', 'Filter by domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)')
    .option('--scope <scope>', 'Project scope identifier (defaults to current project)')
    .option('--global', 'Search only global stewardship rules')
    .action(async (query: string, opts: { domain?: string; scope?: string; global?: boolean }) => {
      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();

      if (opts.domain && !isStandardDomain(opts.domain)) {
        console.warn(chalk.yellow(`Warning: '${opts.domain}' is not a standard domain.`));
      }

      const result = await orch.executeCommand('retrieve' as OrchCommand, {
        query,
        domain: opts.domain,
        scope: opts.scope,
        global: opts.global
      });
      console.log(result.output);
    });

  return sub;
}

function createStoreCommand(): Command {
  const sub = new Command();

  sub
    .name('store')
    .description('Persist a new rule to the knowledge graph')
    .argument('<domain>', 'Rule domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)')
    .option('--content <content>', 'Rule content text')
    .option('--author <author>', 'Author name')
    .option('--scope <scope>', 'Project scope identifier (defaults to current project)')
    .option('--global', 'Persist as a global rule instead of a project rule')
    .action(async (domain: string, opts: { content?: string; author?: string; scope?: string; global?: boolean }) => {
      if (!opts.content) {
        console.error(chalk.red('Error: --content is required for store command.'));
        process.exit(1);
      }

      if (!isStandardDomain(domain)) {
        console.warn(chalk.yellow(`Warning: '${domain}' is not a standard domain. Custom domains are allowed.`));
      }

      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('store' as OrchCommand, {
        domain,
        content: opts.content,
        author: opts.author,
        scope: opts.scope,
        global: opts.global
      });

      if (result.success) {
        console.log(chalk.green(result.output));
      } else {
        console.log(chalk.yellow(result.output));
      }
    });

  return sub;
}

function createExtractCommand(): Command {
  const sub = new Command();

  sub
    .name('extract')
    .description('Extract decision candidates from a design.md or requirements.md file')
    .argument('<filePath>', 'Path to the spec file')
    .option('--author <author>', 'Author name for provenance')
    .action(async (filePath: string, opts: { author?: string }) => {
      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('extract' as OrchCommand, {
        filePath,
        author: opts.author
      });

      console.log(result.output);

      if (result.data) {
        const candidates = result.data as Array<Record<string, unknown>>;
        if (candidates.length > 0) {
          console.log(chalk.cyan('\nCandidates:'));
          for (const c of candidates) {
            console.log(chalk.cyan(`  [${c.domain}] ${c.confidence ? `(confidence: ${(c.confidence as number).toFixed(2)}) ` : ''}${c.content}`));
          }
        }
      }
    });

  return sub;
}

function createTraceCommand(): Command {
  const sub = new Command();

  sub
    .name('trace')
    .description('Show full provenance and version history for a rule')
    .argument('<ruleId>', 'Rule identifier')
    .option('--scope <scope>', 'Project scope identifier (defaults to current project)')
    .option('--global', 'Trace only the global rule store')
    .action(async (ruleId: string, opts: { scope?: string; global?: boolean }) => {
      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('trace' as OrchCommand, {
        ruleId,
        scope: opts.scope,
        global: opts.global
      });

      if (result.success) {
        console.log(result.output);
      } else {
        console.log(chalk.red(result.output));
      }
    });

  return sub;
}

function createInjectCommand(): Command {
  const sub = new Command();

  sub
    .name('inject')
    .description('Retrieve and format relevant context for a spec phase')
    .argument('<phase>', 'Spec phase: requirements, design, tasks, or implementation')
    .option('--scope <scope>', 'Project scope identifier (defaults to current project)')
    .option('--global', 'Inject only global stewardship context')
    .action(async (phase: string, opts: { scope?: string; global?: boolean }) => {
      const validPhases = ['requirements', 'design', 'tasks', 'implementation'];
      if (!validPhases.includes(phase)) {
        console.error(chalk.red(`Error: Invalid phase '${phase}'. Must be one of: ${validPhases.join(', ')}`));
        process.exit(1);
      }

      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('inject' as OrchCommand, {
        phase: phase as 'requirements' | 'design' | 'tasks' | 'implementation',
        scope: opts.scope,
        global: opts.global
      });

      if (result.output) {
        console.log(result.output);
      } else {
        console.log(chalk.yellow('No context found for this phase.'));
      }
    });

  return sub;
}

function createManageCommand(): Command {
  const sub = new Command();

  sub
    .name('manage')
    .description('List, deprecate, archive, or move rules')
    .argument('<action>', 'Action: list, deprecate, archive, or move')
    .option('--ruleId <ruleId>', 'Rule identifier (required for deprecate, archive, and move)')
    .option('--scope <scope>', 'Project scope identifier (defaults to current project; required target for move)')
    .option('--global', 'Manage only global rules')
    .action(async (action: string, opts: { ruleId?: string; scope?: string; global?: boolean }) => {
      const validActions = ['list', 'deprecate', 'archive', 'move'];
      if (!validActions.includes(action)) {
        console.error(chalk.red(`Error: Invalid action '${action}'. Must be one of: ${validActions.join(', ')}`));
        process.exit(1);
      }

      if ((action === 'deprecate' || action === 'archive' || action === 'move') && !opts.ruleId) {
        console.error(chalk.red(`Error: --ruleId is required for '${action}' action.`));
        process.exit(1);
      }

      if (action === 'move' && !opts.scope) {
        console.error(chalk.red("Error: --scope is required for 'move' action."));
        process.exit(1);
      }

      if (action === 'move' && opts.global) {
        console.error(chalk.red("Error: 'move' uses --scope as the target project and cannot be combined with --global."));
        process.exit(1);
      }

      const orch = new ContextStewardshipOrchestrator();
      await orch.initialize();
      const result = await orch.executeCommand('manage' as OrchCommand, {
        action,
        ruleId: opts.ruleId,
        scope: opts.scope,
        global: opts.global
      });

      if (result.success) {
        console.log(result.output);
      } else {
        console.log(chalk.red(result.output));
      }
    });

  return sub;
}
