import type { RetrievalQuery, RuleNode, Domain } from './types.js';
import { ProjectScopedResolver } from './project-scoped-resolver.js';
import { GracefulDegradationRouter } from './graceful-degradation-router.js';

export interface InjectedContext {
  domain: string;
  rules: RuleNode[];
  source: 'session' | 'project' | 'global';
}

export interface SkillPhaseContext {
  phase: 'requirements' | 'design' | 'tasks' | 'implementation';
  relevantDomains: string[];
}

export class McpContextInjector {
  private resolver: ProjectScopedResolver;
  private sessionInjectedContext: Map<string, InjectedContext[]> = new Map();

  constructor(resolver: ProjectScopedResolver, _router: GracefulDegradationRouter) {
    this.resolver = resolver;
    // router reserved for future capability-aware injection
  }

  getRelevantDomainsForPhase(phase: SkillPhaseContext['phase']): string[] {
    switch (phase) {
      case 'requirements':
        return ['business', 'workflow', 'security', 'legal'];
      case 'design':
        return ['architecture', 'security', 'performance', 'technical-debt'];
      case 'tasks':
        return ['workflow', 'team-structure'];
      case 'implementation':
        return ['architecture', 'business', 'workflow'];
      default:
        return [];
    }
  }

  async injectContextForPhase(phase: SkillPhaseContext['phase']): Promise<InjectedContext[]> {
    const domains = this.getRelevantDomainsForPhase(phase);
    const injected: InjectedContext[] = [];

    for (const domain of domains) {
      const query: RetrievalQuery = {
        query: domain,
        domain: domain as Domain,
        includeDeprecated: false,
        limit: 5,
      };

      const result = await this.resolver.resolve(query);
      if (result.rules.length > 0) {
        const context: InjectedContext = {
          domain,
          rules: result.rules.map(r => r.rule),
          source: result.scopesResolved.includes('project') ? 'project' : 'global',
        };
        injected.push(context);
      }
    }

    this.sessionInjectedContext.set(phase, injected);
    return injected;
  }

  formatContextForPrompt(contexts: InjectedContext[]): string {
    if (contexts.length === 0) return '';

    const lines: string[] = [];
    lines.push('\n--- Context from Knowledge Base ---\n');

    for (const ctx of contexts) {
      lines.push(`\n[${ctx.domain.toUpperCase()}] (${ctx.source}):`);
      for (const rule of ctx.rules.slice(0, 3)) {
        const truncated = rule.content.length > 150 ? rule.content.slice(0, 150) + '...' : rule.content;
        lines.push(`  • ${truncated}`);
      }
    }

    lines.push('\n--- End Context ---\n');
    return lines.join('\n');
  }

  async offerToCapture(
    _decision: string,
    _domain: string
  ): Promise<{ accepted: boolean; rule?: RuleNode }> {
    // Placeholder - full implementation connects to orchestrator
    return {
      accepted: false,
    };
  }

  getSessionContext(phase: string): InjectedContext[] {
    return this.sessionInjectedContext.get(phase) ?? [];
  }

  clearSessionContext(): void {
    this.sessionInjectedContext.clear();
  }
}
