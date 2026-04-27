import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import { ProjectScopedResolver } from './project-scoped-resolver.js';
import { LifecycleManager } from './lifecycle-manager.js';
import { GracefulDegradationRouter, defaultRouter } from './graceful-degradation-router.js';
import { SpecDecisionExtractor } from './spec-decision-extractor.js';
import { PhaseContextInjector } from './phase-context-injector.js';
import type { RetrievalQuery, Domain } from './types.js';

export type Command =
  | 'retrieve'
  | 'store'
  | 'extract'
  | 'inject'
  | 'manage'
  | 'capabilities'
  | 'trace';

export interface CommandResult {
  success: boolean;
  output: string;
  data?: unknown;
}

export class ContextStewardshipOrchestrator {
  private globalStore: KnowledgeGraphStore;
  private resolver: ProjectScopedResolver;
  private lifecycle: LifecycleManager;
  private router: GracefulDegradationRouter;
  private extractor: SpecDecisionExtractor;
  private injector: PhaseContextInjector;

  constructor(router?: GracefulDegradationRouter) {
    this.router = router ?? defaultRouter;
    this.globalStore = new KnowledgeGraphStore('global');
    this.resolver = new ProjectScopedResolver(this.globalStore);
    this.lifecycle = new LifecycleManager(this.globalStore);
    this.extractor = new SpecDecisionExtractor(this.globalStore);
    this.injector = new PhaseContextInjector(this.resolver, this.router);
  }

  async initialize(): Promise<void> {
    await this.router.initialize();
  }

  async executeCommand(
    command: Command,
    args: Record<string, unknown>
  ): Promise<CommandResult> {
    switch (command) {
      case 'capabilities':
        return this.commandCapabilities();
      case 'retrieve':
        return this.commandRetrieve(args as { query: string; domain?: Domain; scope?: string });
      case 'store':
        return this.commandStore(args as { domain: Domain; content: string; author?: string });
      case 'extract':
        return this.commandExtract(args as { filePath: string; author?: string });
      case 'trace':
        return this.commandTrace(args as { ruleId: string });
      case 'inject':
        return this.commandInject(args as { phase: 'requirements' | 'design' | 'tasks' | 'implementation' });
      case 'manage':
        return this.commandManage(args as { action: 'list' | 'deprecate' | 'archive'; ruleId?: string });
      default:
        return { success: false, output: `Unknown command: ${command}` };
    }
  }

  private commandCapabilities(): CommandResult {
    const caps = this.router.formatCapabilities();
    return { success: true, output: caps, data: this.router.getCapabilities() };
  }

  private async commandRetrieve(args: { query: string; domain?: Domain; scope?: string }): Promise<CommandResult> {
    if (args.scope) {
      this.resolver.setProjectScope(args.scope);
    }

    const query: RetrievalQuery = {
      query: args.query,
      domain: args.domain,
    };

    const result = await this.resolver.resolve(query);

    const lines: string[] = [`Found ${result.rules.length} rules:`];
    for (const scored of result.rules.slice(0, 10)) {
      const deprecated = scored.rule.state.value === 'deprecated' ? ' [DEPRECATED]' : '';
      const outDomain = scored.isOutOfDomain ? ' [out-of-domain]' : '';
      lines.push(`\n[${scored.rule.domain}]${deprecated}${outDomain}`);
      lines.push(`  Score: ${scored.score.toFixed(2)}`);
      lines.push(`  ${scored.rule.content.slice(0, 100)}${scored.rule.content.length > 100 ? '...' : ''}`);
      if (scored.rule.supersededBy) {
        lines.push(`  Superseded by: ${scored.rule.supersededBy}`);
      }
    }

    return { success: true, output: lines.join('\n'), data: result };
  }

  private async commandStore(args: { domain: Domain; content: string; author?: string }): Promise<CommandResult> {
    const rule = this.globalStore.createRule({
      domain: args.domain,
      content: args.content,
      author: args.author,
    });

    const conflicts = await this.globalStore.detectConflicts(rule);
    if (conflicts.length > 0) {
      const conflictLines = ['Potential conflicts detected:', ...conflicts.map(c =>
        `  - Similarity ${c.similarity.toFixed(2)}: ${c.rule.content.slice(0, 60)}...`
      )];
      conflictLines.push('Use store with conflict resolution or cancel.');

      return {
        success: false,
        output: conflictLines.join('\n'),
        data: { rule, conflicts },
      };
    }

    await this.globalStore.saveRule(rule);
    return { success: true, output: `Rule created: ${rule.id}`, data: { rule } };
  }

  private async commandExtract(args: { filePath: string; author?: string }): Promise<CommandResult> {
    const candidates = this.extractor.extractFromDesign(args.filePath, args.author);

    if (candidates.length === 0) {
      // Try requirements parsing
      const reqCandidates = this.extractor.extractFromRequirements(args.filePath, args.author);
      if (reqCandidates.length === 0) {
        return { success: true, output: 'No extraction candidates found.', data: [] };
      }
      return {
        success: true,
        output: `Found ${reqCandidates.length} extraction candidates from requirements.`,
        data: reqCandidates,
      };
    }

    return {
      success: true,
      output: `Found ${candidates.length} extraction candidates from design.`,
      data: candidates,
    };
  }

  private async commandTrace(args: { ruleId: string }): Promise<CommandResult> {
    const rule = await this.globalStore.readRule(args.ruleId);
    if (!rule) {
      return { success: false, output: `Rule not found: ${args.ruleId}` };
    }

    const history = await this.globalStore.getRuleHistory(args.ruleId);
    const lines: string[] = [
      `Rule: ${rule.id}`,
      `Domain: ${rule.domain}`,
      `Content: ${rule.content}`,
      `State: ${rule.state.value}`,
      `Provenance: ${rule.provenance.source} (${rule.provenance.sourceFile ?? 'no file'})`,
      `Decision date: ${rule.provenance.decisionDate}`,
      `Author: ${rule.provenance.author}`,
    ];

    if (rule.supersededBy) {
      lines.push(`Superseded by: ${rule.supersededBy}`);
    }

    if (history.length > 0) {
      lines.push(`\nVersion history (${history.length} changes):`);
      for (const v of history) {
        lines.push(`  v${v.version}: ${v.timestamp} by ${v.changedBy} (${v.previousState.value} -> ${rule.state.value})`);
      }
    }

    return { success: true, output: lines.join('\n'), data: { rule, history } };
  }

  private async commandInject(args: { phase: 'requirements' | 'design' | 'tasks' | 'implementation' }): Promise<CommandResult> {
    const context = await this.injector.injectContextForPhase(args.phase);
    const formatted = this.injector.formatContextForPrompt(context);
    return { success: true, output: formatted || 'No context found for this phase.', data: context };
  }

  private async commandManage(args: { action: 'list' | 'deprecate' | 'archive'; ruleId?: string }): Promise<CommandResult> {
    switch (args.action) {
      case 'list': {
        const rules = await this.globalStore.listRules();
        const grouped = this.lifecycle.groupByLifecycleState(rules);
        const lines: string[] = [];
        for (const [state, stateRules] of Object.entries(grouped)) {
          lines.push(`\n${state.toUpperCase()} (${stateRules.length}):`);
          for (const rule of stateRules.slice(0, 5)) {
            lines.push(`  - ${rule.id}: ${rule.content.slice(0, 60)}...`);
          }
        }
        return { success: true, output: lines.join('\n'), data: grouped };
      }
      case 'deprecate': {
        if (!args.ruleId) {
          return { success: false, output: 'ruleId required for deprecate action' };
        }
        const updated = await this.lifecycle.transitionState(args.ruleId, 'deprecated', 'agent');
        return { success: true, output: updated ? `Deprecated: ${updated.id}` : 'Rule not found' };
      }
      case 'archive': {
        if (!args.ruleId) {
          return { success: false, output: 'ruleId required for archive action' };
        }
        const updated = await this.lifecycle.transitionState(args.ruleId, 'archived', 'agent');
        return { success: true, output: updated ? `Archived: ${updated.id}` : 'Rule not found' };
      }
      default:
        return { success: false, output: `Unknown manage action: ${args.action}` };
    }
  }
}

export async function runCommand(command: Command, args: Record<string, unknown>): Promise<CommandResult> {
  const orchestrator = new ContextStewardshipOrchestrator();
  await orchestrator.initialize();
  return orchestrator.executeCommand(command, args);
}
