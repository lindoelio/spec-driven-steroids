import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  RuleNode,
  RuleVersion,
  Provenance,
  Metadata,
  LifecycleState,
  Domain,
  ConflictDecision,
} from './types.js';
import {
  DEFAULT_EXPIRATION_YEARS,
  CONFLICT_SIMILARITY_THRESHOLD,
} from './types.js';
import { computeSimilarity } from './utils.js';

const BASE_DIR = join(homedir(), '.agents', 'stewardship');

type ScopeLevel = 'global' | 'org' | 'project';

export interface KnowledgeGraphStoreConfig {
  conflictSimilarityThreshold?: number;
}

function getScopeDir(scope: ScopeLevel, scopeId?: string): string {
  if (scope === 'global') return join(BASE_DIR, 'global');
  if (scope === 'org') return join(BASE_DIR, 'orgs', scopeId ?? 'default');
  return join(BASE_DIR, 'projects', scopeId ?? 'default');
}

function getStateDir(base: string, state: string): string {
  return join(base, state);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getRulePath(dir: string, id: string): string {
  return join(dir, `${id}.json`);
}

function getVersionPath(dir: string, id: string): string {
  return join(dir, `${id}.json`);
}

export class KnowledgeGraphStore {
  private scopeId?: string;
  private baseDir: string;
  private conflictThreshold: number;
  /** Write-lock queue: ensures serialized writes per rule ID to prevent concurrent-write corruption */
  private writeLocks: Map<string, Promise<unknown>> = new Map();

  constructor(scope: ScopeLevel = 'global', scopeId?: string, config?: KnowledgeGraphStoreConfig) {
    this.scopeId = scopeId;
    this.baseDir = getScopeDir(scope, scopeId);
    this.conflictThreshold = config?.conflictSimilarityThreshold ?? CONFLICT_SIMILARITY_THRESHOLD;
    this.ensureDirectoryStructure();
  }

  setConflictThreshold(threshold: number): void {
    this.conflictThreshold = threshold;
  }

  private ensureDirectoryStructure(): void {
    for (const state of ['active', 'deprecated', 'archived']) {
      ensureDir(getStateDir(this.baseDir, state));
    }
    ensureDir(join(this.baseDir, '.versions'));
  }

  private generateId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  createRule(params: {
    domain: Domain;
    subDomain?: string;
    content: string;
    author?: string;
    provenance?: Partial<Provenance>;
    metadata?: Partial<Metadata>;
    projectScope?: string;
  }): RuleNode {
    const id = this.generateId();
    const author = params.author ?? 'agent';
    const now = new Date().toISOString();

    const provenance: Provenance = {
      source: params.provenance?.source ?? 'manual',
      sourceFile: params.provenance?.sourceFile,
      decisionDate: params.provenance?.decisionDate ?? now,
      author: params.provenance?.author ?? author,
      originalText: params.provenance?.originalText ?? params.content,
    };

    const metadata: Metadata = {
      confidence: params.metadata?.confidence ?? 0.8,
      expiresAt: params.metadata?.expiresAt ?? this.addYears(new Date(), DEFAULT_EXPIRATION_YEARS).toISOString(),
      tags: params.metadata?.tags ?? [],
    };

    const state: LifecycleState = {
      value: 'active',
      changedAt: now,
      changedBy: author,
    };

    const rule: RuleNode = {
      id,
      domain: params.domain,
      subDomain: params.subDomain,
      content: params.content,
      provenance,
      metadata,
      state,
      projectScope: params.projectScope ?? this.scopeId,
      relations: [],
    };

    return rule;
  }

  async saveRule(rule: RuleNode): Promise<void> {
    // Serialize writes per rule ID to prevent concurrent-write corruption
    let lock = this.writeLocks.get(rule.id);
    const newLock = (async () => {
      if (lock) await lock;
      const stateDir = getStateDir(this.baseDir, rule.state.value);
      const rulePath = getRulePath(stateDir, rule.id);
      try {
        writeFileSync(rulePath, JSON.stringify(rule, null, 2), 'utf-8');
      } catch (err) {
        throw new Error(`Failed to save rule ${rule.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    this.writeLocks.set(rule.id, newLock);
    await newLock;
  }

  async readRule(ruleId: string, state?: string): Promise<RuleNode | null> {
    const states = state ? [state] : ['active', 'deprecated', 'archived'];
    for (const s of states) {
      const rulePath = getRulePath(getStateDir(this.baseDir, s), ruleId);
      if (existsSync(rulePath)) {
        try {
          const content = readFileSync(rulePath, 'utf-8');
          return JSON.parse(content) as RuleNode;
        } catch {
          // Corrupted file — skip and continue
          return null;
        }
      }
    }
    return null;
  }

  async updateRule(ruleId: string, updates: Partial<RuleNode>, changedBy: string): Promise<RuleNode | null> {
    // Serialize updates per rule ID
    let lock = this.writeLocks.get(ruleId);
    const newLock = (async () => {
      if (lock) await lock;
      const rule = await this.readRule(ruleId);
      if (!rule) return null;

      await this.archiveVersion(rule, changedBy);

      const updatedRule: RuleNode = {
        ...rule,
        ...updates,
        id: rule.id, // prevent ID change
        provenance: updates.provenance ?? rule.provenance,
        state: {
          ...(updates.state ?? rule.state),
          changedAt: new Date().toISOString(),
          changedBy,
        },
      };

      if (rule.state.value !== updatedRule.state.value) {
        // Move to new state directory
        const oldStateDir = getStateDir(this.baseDir, rule.state.value);
        const newStateDir = getStateDir(this.baseDir, updatedRule.state.value);
        const oldPath = getRulePath(oldStateDir, ruleId);
        const newPath = getRulePath(newStateDir, ruleId);

        if (existsSync(oldPath)) {
          rmSync(oldPath);
        }
        writeFileSync(newPath, JSON.stringify(updatedRule, null, 2), 'utf-8');
      } else {
        const stateDir = getStateDir(this.baseDir, rule.state.value);
        const rulePath = getRulePath(stateDir, rule.id);
        writeFileSync(rulePath, JSON.stringify(updatedRule, null, 2), 'utf-8');
      }

      return updatedRule;
    })();
    this.writeLocks.set(ruleId, newLock);
    return newLock as Promise<RuleNode | null>;
  }

  async listRules(params?: {
    domain?: Domain;
    state?: string;
    projectScope?: string;
  }): Promise<RuleNode[]> {
    const states = params?.state ? [params.state] : ['active', 'deprecated', 'archived'];
    const rules: RuleNode[] = [];

    for (const state of states) {
      const stateDir = getStateDir(this.baseDir, state);
      if (!existsSync(stateDir)) continue;

      const files = readdirSync(stateDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const rulePath = join(stateDir, file);
          const rule = JSON.parse(readFileSync(rulePath, 'utf-8')) as RuleNode;

          if (params?.domain && rule.domain !== params.domain) continue;
          if (params?.projectScope && rule.projectScope !== params.projectScope) continue;

          rules.push(rule);
        } catch {
          // Corrupted file — skip silently
        }
      }
    }

    return rules;
  }

  async deprecateRule(ruleId: string, supersededBy: string, changedBy: string): Promise<RuleNode | null> {
    return this.updateRule(ruleId, { supersededBy, state: { value: 'deprecated', changedAt: new Date().toISOString(), changedBy } }, changedBy);
  }

  async archiveRule(ruleId: string, changedBy: string): Promise<RuleNode | null> {
    return this.updateRule(ruleId, { state: { value: 'archived', changedAt: new Date().toISOString(), changedBy } }, changedBy);
  }

  private async archiveVersion(rule: RuleNode, changedBy: string): Promise<void> {
    const versionsDir = join(this.baseDir, '.versions');
    ensureDir(versionsDir);
    const versionPath = getVersionPath(versionsDir, rule.id);

    let versions: RuleVersion[] = [];
    if (existsSync(versionPath)) {
      versions = JSON.parse(readFileSync(versionPath, 'utf-8'));
    }

    const newVersion: RuleVersion = {
      ruleId: rule.id,
      version: versions.length + 1,
      timestamp: new Date().toISOString(),
      changedBy,
      previousState: rule.state,
    };

    versions.push(newVersion);
    writeFileSync(versionPath, JSON.stringify(versions, null, 2), 'utf-8');
  }

  async getRuleHistory(ruleId: string): Promise<RuleVersion[]> {
    const versionPath = getVersionPath(join(this.baseDir, '.versions'), ruleId);
    if (!existsSync(versionPath)) return [];
    return JSON.parse(readFileSync(versionPath, 'utf-8'));
  }

  async detectConflicts(newRule: RuleNode, threshold?: number): Promise<Array<{ rule: RuleNode; similarity: number }>> {
    const effectiveThreshold = threshold ?? this.conflictThreshold;
    const existingRules = await this.listRules({ domain: newRule.domain, state: 'active' });
    const conflicts: Array<{ rule: RuleNode; similarity: number }> = [];

    for (const rule of existingRules) {
      if (rule.id === newRule.id) continue;
      const similarity = computeSimilarity(newRule.content, rule.content);
      if (similarity >= effectiveThreshold) {
        conflicts.push({ rule, similarity });
      }
    }

    return conflicts;
  }

  async handleConflict(
    existingRuleId: string,
    newRule: RuleNode,
    decision: ConflictDecision,
    changedBy: string
  ): Promise<RuleNode | null> {
    if (decision === 'cancel') {
      return null;
    }

    if (decision === 'override') {
      await this.deprecateRule(existingRuleId, newRule.id, changedBy);
      return this.saveRule(newRule).then(() => newRule);
    }

    // merge - combine content and keep newer
    const existingRule = await this.readRule(existingRuleId);
    if (!existingRule) return null;

    const mergedRule: RuleNode = {
      ...existingRule,
      id: newRule.id,
      content: `${existingRule.content}\n---\n${newRule.content}`,
      provenance: newRule.provenance,
      metadata: {
        ...existingRule.metadata,
        confidence: Math.max(existingRule.metadata.confidence, newRule.metadata.confidence),
      },
      state: {
        value: 'active',
        changedAt: new Date().toISOString(),
        changedBy,
      },
      supersededBy: existingRule.id, // old rule superseded by merged
    };

    await this.deprecateRule(existingRuleId, mergedRule.id, changedBy);
    return this.saveRule(mergedRule).then(() => mergedRule);
  }
}
