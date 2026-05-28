import type { RuleNode, RetrievalQuery, RetrievalResult, ScoredRule } from './types.js';
import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import { SemanticRetrievalEngine } from './semantic-retrieval-engine.js';
import { computeSimilarity } from './utils.js';
import { cwd } from 'process';
import { basename } from 'path';

export interface ScopeResolutionResult {
  rules: ScoredRule[];
  scopesResolved: string[];
  conflicts: Array<{ projectRule: RuleNode; globalRule: RuleNode }>;
}

interface CachedResult {
  rules: ScoredRule[];
  timestamp: number;
}

export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class ProjectScopedResolver {
  private globalStore: KnowledgeGraphStore;
  private projectStore?: KnowledgeGraphStore;
  private currentProjectScope?: string;
  private engine: SemanticRetrievalEngine;
  private sessionCache: Map<string, CachedResult> = new Map();
  private cacheTtlMs: number = DEFAULT_CACHE_TTL_MS;

  constructor(globalStore: KnowledgeGraphStore, cacheTtlMs?: number) {
    this.globalStore = globalStore;
    this.engine = new SemanticRetrievalEngine(globalStore);
    if (cacheTtlMs !== undefined) this.cacheTtlMs = cacheTtlMs;
  }

  setCacheTtl(ttlMs: number): void {
    this.cacheTtlMs = ttlMs;
  }

  setProjectScope(projectId: string): void {
    this.currentProjectScope = projectId;
    this.projectStore = new KnowledgeGraphStore('project', projectId);
    this.engine = new SemanticRetrievalEngine(this.projectStore);
    this.clearSessionCache();
  }

  clearProjectScope(): void {
    this.currentProjectScope = undefined;
    this.projectStore = undefined;
    this.engine = new SemanticRetrievalEngine(this.globalStore);
    this.clearSessionCache();
  }

  detectCurrentProject(): string | undefined {
    return basename(cwd()) || undefined;
  }

  async resolve(query: RetrievalQuery): Promise<ScopeResolutionResult> {
    const scopesResolved: string[] = [];
    const allRules: ScoredRule[] = [];
    const conflicts: Array<{ projectRule: RuleNode; globalRule: RuleNode }> = [];

    // Check session cache first (with TTL expiration)
    const scopeKey = this.projectStore ? `project:${this.currentProjectScope ?? 'active'}` : 'global';
    const cacheKey = JSON.stringify({ scopeKey, query });
    if (this.sessionCache.has(cacheKey)) {
      const cached = this.sessionCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTtlMs) {
        scopesResolved.push('session');
        return { rules: cached.rules, scopesResolved: ['session'], conflicts: [] };
      }
      // Expired — remove and continue
      this.sessionCache.delete(cacheKey);
    }

    // Session cache miss - query stores
    if (this.projectStore) {
      const projectResults = await this.engine.retrieve({ ...query, projectScope: undefined });
      allRules.push(...projectResults.rules);
      scopesResolved.push('project');

      // Check for conflicts with global rules
      const globalResults = await this.resolveGlobal(query);
      for (const projectRule of projectResults.rules) {
        for (const globalRule of globalResults.rules) {
          if (
            projectRule.rule.domain === globalRule.rule.domain &&
            projectRule.rule.id !== globalRule.rule.id
          ) {
            // Semantic similarity check
            const similarity = computeSimilarity(
              projectRule.rule.content,
              globalRule.rule.content
            );
            if (similarity > 0.7) {
              conflicts.push({ projectRule: projectRule.rule, globalRule: globalRule.rule });
            }
          }
        }
      }
    }

    // Fall through to global
    const globalResults = await this.resolveGlobal(query);
    allRules.push(...globalResults.rules);
    scopesResolved.push('global');

    // Merge and dedupe
    const deduped = this.dedupeRules(allRules);
    const ranked = this.rankScopedResults(deduped);

    // Cache results with timestamp
    this.sessionCache.set(cacheKey, { rules: ranked, timestamp: Date.now() });

    return { rules: ranked, scopesResolved, conflicts };
  }

  private async resolveGlobal(query: RetrievalQuery): Promise<RetrievalResult> {
    const globalEngine = new SemanticRetrievalEngine(this.globalStore);
    return globalEngine.retrieve(query);
  }

  private dedupeRules(rules: ScoredRule[]): ScoredRule[] {
    const seen = new Map<string, ScoredRule>();
    for (const rule of rules) {
      const existing = seen.get(rule.rule.id);
      if (!existing || rule.score > existing.score) {
        seen.set(rule.rule.id, rule);
      }
    }
    return Array.from(seen.values());
  }

  private rankScopedResults(rules: ScoredRule[]): ScoredRule[] {
    const ranked = this.engine.rankResults(rules);
    if (!this.currentProjectScope) return ranked;

    return ranked.sort((a, b) => {
      if (a.rule.state.value !== b.rule.state.value) {
        if (a.rule.state.value === 'active') return -1;
        if (b.rule.state.value === 'active') return 1;
      }

      const aProject = a.rule.projectScope === this.currentProjectScope;
      const bProject = b.rule.projectScope === this.currentProjectScope;
      if (aProject !== bProject) return aProject ? -1 : 1;

      return b.score - a.score;
    });
  }

  clearSessionCache(): void {
    this.sessionCache.clear();
  }

  getScopesResolved(): string[] {
    return Array.from(new Set([...this.sessionCache.keys()]));
  }
}
