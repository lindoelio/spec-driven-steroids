import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import { ProjectScopedResolver } from './project-scoped-resolver.js';
import { LifecycleManager } from './lifecycle-manager.js';
import { GracefulDegradationRouter, defaultRouter } from './graceful-degradation-router.js';
import { SpecDecisionExtractor } from './spec-decision-extractor.js';
import { PhaseContextInjector } from './phase-context-injector.js';
import type { RetrievalQuery, Domain, RuleNode } from './types.js';

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

type ScopeSelection =
  | { kind: 'global' }
  | { kind: 'project'; projectId: string };

interface ScopedConflict {
  rule: RuleNode;
  similarity: number;
  scope: string;
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
        return this.commandRetrieve(args as { query: string; domain?: Domain; scope?: string; global?: boolean });
      case 'store':
        return this.commandStore(args as { domain: Domain; content: string; author?: string; scope?: string; global?: boolean });
      case 'extract':
        return this.commandExtract(args as { filePath: string; author?: string });
      case 'trace':
        return this.commandTrace(args as { ruleId: string; scope?: string; global?: boolean });
      case 'inject':
        return this.commandInject(args as { phase: 'requirements' | 'design' | 'tasks' | 'implementation'; scope?: string; global?: boolean });
      case 'manage':
        return this.commandManage(args as { action: 'list' | 'deprecate' | 'archive' | 'move'; ruleId?: string; scope?: string; global?: boolean });
      default:
        return { success: false, output: `Unknown command: ${command}` };
    }
  }

  private commandCapabilities(): CommandResult {
    const caps = this.router.formatCapabilities();
    return { success: true, output: caps, data: this.router.getCapabilities() };
  }

  private validateScopeOptions(args: { scope?: string; global?: boolean }): string | undefined {
    if (args.global && args.scope) {
      return 'Use either --global or --scope, not both.';
    }
    return undefined;
  }

  private resolveProjectScope(scope?: string): string {
    return scope?.trim() || this.resolver.detectCurrentProject() || 'default';
  }

  private resolveTargetScope(args: { scope?: string; global?: boolean }): ScopeSelection {
    if (args.global) return { kind: 'global' };
    return { kind: 'project', projectId: this.resolveProjectScope(args.scope) };
  }

  private configureResolverForScope(args: { scope?: string; global?: boolean }): ScopeSelection {
    const scope = this.resolveTargetScope(args);
    if (scope.kind === 'global') {
      this.resolver.clearProjectScope();
      return scope;
    }

    this.resolver.setProjectScope(scope.projectId);
    return scope;
  }

  private createStoreForScope(scope: ScopeSelection): KnowledgeGraphStore {
    if (scope.kind === 'global') return this.globalStore;
    return new KnowledgeGraphStore('project', scope.projectId);
  }

  private formatScope(scope: ScopeSelection): string {
    return scope.kind === 'global' ? 'global' : `project:${scope.projectId}`;
  }

  private formatScopeChain(scope: ScopeSelection): string {
    return scope.kind === 'global' ? 'global' : `project:${scope.projectId} -> global`;
  }

  private formatRuleScope(rule: RuleNode): string {
    return rule.projectScope ? `project:${rule.projectScope}` : 'global';
  }

  private async detectConflictsForScope(
    rule: RuleNode,
    targetStore: KnowledgeGraphStore,
    scope: ScopeSelection
  ): Promise<ScopedConflict[]> {
    const conflicts = (await targetStore.detectConflicts(rule)).map(conflict => ({
      ...conflict,
      scope: this.formatScope(scope),
    }));

    if (scope.kind === 'project') {
      const globalConflicts = (await this.globalStore.detectConflicts(rule)).map(conflict => ({
        ...conflict,
        scope: 'global',
      }));
      conflicts.push(...globalConflicts);
    }

    return conflicts;
  }

  private async commandRetrieve(args: { query: string; domain?: Domain; scope?: string; global?: boolean }): Promise<CommandResult> {
    const scopeError = this.validateScopeOptions(args);
    if (scopeError) {
      return { success: false, output: scopeError };
    }

    const scope = this.configureResolverForScope(args);

    const query: RetrievalQuery = {
      query: args.query,
      domain: args.domain,
    };

    const result = await this.resolver.resolve(query);

    const lines: string[] = [`Found ${result.rules.length} rules (${this.formatScopeChain(scope)}):`];
    for (const scored of result.rules.slice(0, 10)) {
      const deprecated = scored.rule.state.value === 'deprecated' ? ' [DEPRECATED]' : '';
      const outDomain = scored.isOutOfDomain ? ' [out-of-domain]' : '';
      lines.push(`\n[${scored.rule.domain}] [${this.formatRuleScope(scored.rule)}]${deprecated}${outDomain}`);
      lines.push(`  Score: ${scored.score.toFixed(2)}`);
      lines.push(`  ${scored.rule.content.slice(0, 100)}${scored.rule.content.length > 100 ? '...' : ''}`);
      if (scored.rule.supersededBy) {
        lines.push(`  Superseded by: ${scored.rule.supersededBy}`);
      }
    }

    return { success: true, output: lines.join('\n'), data: result };
  }

  private async commandStore(args: { domain: Domain; content: string; author?: string; scope?: string; global?: boolean }): Promise<CommandResult> {
    const scopeError = this.validateScopeOptions(args);
    if (scopeError) {
      return { success: false, output: scopeError };
    }

    const scope = this.resolveTargetScope(args);
    const store = this.createStoreForScope(scope);
    const rule = store.createRule({
      domain: args.domain,
      content: args.content,
      author: args.author,
    });

    const conflicts = await this.detectConflictsForScope(rule, store, scope);
    if (conflicts.length > 0) {
      const conflictLines = ['Potential conflicts detected:', ...conflicts.map(c =>
        `  - Similarity ${c.similarity.toFixed(2)} (${c.scope}): ${c.rule.content.slice(0, 60)}...`
      )];
      conflictLines.push('Use store with conflict resolution or cancel.');

      return {
        success: false,
        output: conflictLines.join('\n'),
        data: { rule, conflicts },
      };
    }

    await store.saveRule(rule);
    return { success: true, output: `Rule created: ${rule.id} (${this.formatScope(scope)})`, data: { rule } };
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

  private async commandTrace(args: { ruleId: string; scope?: string; global?: boolean }): Promise<CommandResult> {
    const scopeError = this.validateScopeOptions(args);
    if (scopeError) {
      return { success: false, output: scopeError };
    }

    const projectScope = args.global ? undefined : this.resolveProjectScope(args.scope);
    const projectStore = projectScope ? new KnowledgeGraphStore('project', projectScope) : undefined;
    const projectRule = projectStore ? await projectStore.readRule(args.ruleId) : null;
    const rule = projectRule ?? await this.globalStore.readRule(args.ruleId);
    const store = projectRule && projectStore ? projectStore : this.globalStore;
    if (!rule) {
      return { success: false, output: `Rule not found: ${args.ruleId}` };
    }

    const history = await store.getRuleHistory(args.ruleId);
    const lines: string[] = [
      `Rule: ${rule.id}`,
      `Scope: ${this.formatRuleScope(rule)}`,
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

  private async commandInject(args: { phase: 'requirements' | 'design' | 'tasks' | 'implementation'; scope?: string; global?: boolean }): Promise<CommandResult> {
    const scopeError = this.validateScopeOptions(args);
    if (scopeError) {
      return { success: false, output: scopeError };
    }

    this.configureResolverForScope(args);
    const context = await this.injector.injectContextForPhase(args.phase);
    const formatted = this.injector.formatContextForPrompt(context);
    return { success: true, output: formatted || 'No context found for this phase.', data: context };
  }

  private async commandManage(args: { action: 'list' | 'deprecate' | 'archive' | 'move'; ruleId?: string; scope?: string; global?: boolean }): Promise<CommandResult> {
    if (args.action !== 'move') {
      const scopeError = this.validateScopeOptions(args);
      if (scopeError) {
        return { success: false, output: scopeError };
      }
    }

    switch (args.action) {
      case 'list': {
        const scope = this.resolveTargetScope(args);
        const store = this.createStoreForScope(scope);
        const rules = await store.listRules();
        const grouped = this.lifecycle.groupByLifecycleState(rules);
        const lines: string[] = [`Scope: ${this.formatScope(scope)}`];
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
        const scope = this.resolveTargetScope(args);
        const store = this.createStoreForScope(scope);
        const lifecycle = scope.kind === 'global' ? this.lifecycle : new LifecycleManager(store);
        let updated = await lifecycle.transitionState(args.ruleId, 'deprecated', 'agent');
        if (!updated && scope.kind === 'project' && !args.scope) {
          updated = await this.lifecycle.transitionState(args.ruleId, 'deprecated', 'agent');
        }
        return { success: true, output: updated ? `Deprecated: ${updated.id}` : 'Rule not found' };
      }
      case 'archive': {
        if (!args.ruleId) {
          return { success: false, output: 'ruleId required for archive action' };
        }
        const scope = this.resolveTargetScope(args);
        const store = this.createStoreForScope(scope);
        const lifecycle = scope.kind === 'global' ? this.lifecycle : new LifecycleManager(store);
        let updated = await lifecycle.transitionState(args.ruleId, 'archived', 'agent');
        if (!updated && scope.kind === 'project' && !args.scope) {
          updated = await this.lifecycle.transitionState(args.ruleId, 'archived', 'agent');
        }
        return { success: true, output: updated ? `Archived: ${updated.id}` : 'Rule not found' };
      }
      case 'move': {
        if (!args.ruleId) {
          return { success: false, output: 'ruleId required for move action' };
        }
        if (args.global) {
          return { success: false, output: 'move action cannot be combined with global scope' };
        }
        if (!args.scope) {
          return { success: false, output: 'scope required for move action' };
        }

        const sourceRule = await this.globalStore.readRule(args.ruleId, 'active');
        if (!sourceRule) {
          return { success: false, output: `Active global rule not found: ${args.ruleId}` };
        }

        const targetScope: ScopeSelection = { kind: 'project', projectId: args.scope };
        const targetStore = this.createStoreForScope(targetScope);
        const movedRule: RuleNode = {
          ...sourceRule,
          projectScope: args.scope,
          state: {
            ...sourceRule.state,
            changedAt: new Date().toISOString(),
            changedBy: 'agent',
          },
        };

        const conflicts = await targetStore.detectConflicts(movedRule);
        if (conflicts.length > 0) {
          const conflictLines = ['Potential project conflicts detected:', ...conflicts.map(c =>
            `  - Similarity ${c.similarity.toFixed(2)}: ${c.rule.content.slice(0, 60)}...`
          )];
          return { success: false, output: conflictLines.join('\n'), data: { rule: movedRule, conflicts } };
        }

        await targetStore.saveRule(movedRule);
        await this.lifecycle.transitionState(sourceRule.id, 'archived', 'agent');
        return { success: true, output: `Moved: ${sourceRule.id} global -> ${this.formatScope(targetScope)}`, data: { rule: movedRule } };
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
