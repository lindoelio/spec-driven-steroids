import type {
  RuleNode,
  RetrievalQuery,
  RetrievalResult,
  ScoredRule,
} from './types.js';
import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import { searchDomains } from './domain-taxonomy.js';

function computeKeywordScore(query: string, rule: RuleNode): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const contentWords = rule.content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0 || contentWords.length === 0) return 0;

  const matched = queryWords.filter(qw =>
    contentWords.some(cw => cw.includes(qw) || qw.includes(cw))
  );

  return matched.length / queryWords.length;
}

function computeRecencyScore(rule: RuleNode): number {
  const decisionDate = new Date(rule.provenance.decisionDate);
  const now = new Date();
  const ageInDays = (now.getTime() - decisionDate.getTime()) / (1000 * 60 * 60 * 24);
  // Decay: 1.0 for very recent, 0.5 for 1 year old, approaching 0 for older
  return Math.max(0, 1 - ageInDays / 365);
}

function computeConfidenceScore(rule: RuleNode): number {
  return rule.metadata.confidence;
}

export class SemanticRetrievalEngine {
  private store: KnowledgeGraphStore;

  constructor(store: KnowledgeGraphStore) {
    this.store = store;
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    let rules = await this.store.listRules({
      state: query.lifecycleState ?? 'active',
    });

    if (!query.includeDeprecated && !query.lifecycleState) {
      rules = rules.filter(r => r.state.value === 'active');
    }

    if (query.projectScope) {
      rules = rules.filter(r => r.projectScope === query.projectScope);
    }

    const domainFilterResults: ScoredRule[] = [];
    const crossDomainResults: ScoredRule[] = [];

    const queryDomains = query.domain
      ? [query.domain, ...searchDomains(query.domain)]
      : [];

    for (const rule of rules) {
      const keywordScore = computeKeywordScore(query.query, rule);
      const recencyScore = computeRecencyScore(rule);
      const confidenceScore = computeConfidenceScore(rule);
      const compositeScore = keywordScore * 0.5 + recencyScore * 0.3 + confidenceScore * 0.2;

      const isDomainMatch = queryDomains.length === 0 || queryDomains.includes(rule.domain);

      if (keywordScore > 0 || query.query.trim() === '') {
        const scoredRule: ScoredRule = {
          rule,
          score: compositeScore,
          isOutOfDomain: !isDomainMatch,
        };

        if (isDomainMatch) {
          domainFilterResults.push(scoredRule);
        } else {
          crossDomainResults.push(scoredRule);
        }
      }
    }

    // Sort by score descending
    domainFilterResults.sort((a, b) => b.score - a.score);
    crossDomainResults.sort((a, b) => b.score - a.score);

    // If no domain-filtered results, fall back to cross-domain
    const finalResults =
      domainFilterResults.length > 0
        ? [...domainFilterResults, ...crossDomainResults.map(r => ({ ...r, isOutOfDomain: true }))]
        : crossDomainResults.map(r => ({ ...r, isOutOfDomain: true }));

    const limit = query.limit ?? 20;
    const limitedResults = finalResults.slice(0, limit);

    return {
      rules: limitedResults,
      totalCount: finalResults.length,
      query,
    };
  }

  rankResults(rules: ScoredRule[]): ScoredRule[] {
    return rules.sort((a, b) => {
      // Active rules first
      if (a.rule.state.value !== b.rule.state.value) {
        if (a.rule.state.value === 'active') return -1;
        if (b.rule.state.value === 'active') return 1;
      }
      return b.score - a.score;
    });
  }
}
