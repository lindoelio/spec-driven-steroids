import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, cpSync, renameSync, openSync, closeSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { homedir } from 'os';
import { basename } from 'path';
import { cwd } from 'process';
import type {
  RuleNode,
  RuleVersion,
  Provenance,
  Metadata,
  LifecycleState,
  Domain,
} from './types.js';
import {
  DEFAULT_EXPIRATION_YEARS,
  CONFLICT_SIMILARITY_THRESHOLD,
} from './types.js';
import { computeSimilarity } from './utils.js';

const DEFAULT_STEWARDSHIP_DIR = '.agents';
const SCOPE_DIR_NAME = 'stewardship';

type ScopeLevel = 'global' | 'org' | 'project';

export interface KnowledgeGraphStoreConfig {
  conflictSimilarityThreshold?: number;
  /** Root stewardship directory; the store appends the scope subdirectory. */
  rootDir?: string;
}

function getDefaultBaseDir(): string {
  const root = process.env.SDS_HOME
    ? path.join(process.env.SDS_HOME, SCOPE_DIR_NAME)
    : path.join(homedir(), DEFAULT_STEWARDSHIP_DIR, SCOPE_DIR_NAME);
  return root;
}

function getScopeDir(baseDir: string, scope: ScopeLevel, scopeId?: string): string {
  if (scope === 'global') return join(baseDir, 'global');
  if (scope === 'org') return join(baseDir, 'orgs', sanitizeScopeId(scopeId ?? 'default'));
  return join(baseDir, 'projects', sanitizeScopeId(scopeId ?? 'default'));
}

export function sanitizeScopeId(scopeId: string): string {
  const sanitized = scopeId.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!sanitized || sanitized === '.' || sanitized === '..' || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new Error(`Invalid stewardship scope id: ${scopeId}`);
  }
  return sanitized;
}

function atomicWriteFileSync(filePath: string, contents: string): void {
  const tempPath = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  writeFileSync(tempPath, contents, 'utf-8');
  renameSync(tempPath, filePath);
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireFileLock(lockPath: string, timeoutMs = 5_000): () => void {
  ensureDir(path.dirname(lockPath));
  const startedAt = Date.now();

  while (true) {
    try {
      const descriptor = openSync(lockPath, 'wx');
      writeFileSync(descriptor, String(process.pid));
      closeSync(descriptor);
      return () => rmSync(lockPath, { force: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;

      try {
        const owner = Number(readFileSync(lockPath, 'utf-8'));
        if (Number.isInteger(owner) && owner > 0) {
          process.kill(owner, 0);
        }
      } catch {
        rmSync(lockPath, { force: true });
        continue;
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for stewardship write lock: ${lockPath}`);
      }
      sleepSync(25);
    }
  }
}

function migrateLegacyProjectScope(scope: ScopeLevel, scopeId: string | undefined, targetBaseDir: string): void {
  if (scope !== 'project' || !scopeId || existsSync(targetBaseDir)) return;

  let legacyId: string;
  try {
    legacyId = sanitizeScopeId(basename(cwd()));
  } catch {
    return;
  }

  if (legacyId === scopeId) return;
  const legacyDir = join(getDefaultBaseDir(), 'projects', legacyId);
  if (!existsSync(legacyDir)) return;

  try {
    cpSync(legacyDir, targetBaseDir, { recursive: true });
  } catch {
    // Migration is best-effort; a failed copy must not block the new store.
  }
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
  private scopeDir: string;
  private conflictThreshold: number;

  constructor(scope: ScopeLevel = 'global', scopeId?: string, config?: KnowledgeGraphStoreConfig) {
    this.scopeId = scopeId;
    this.scopeDir = getScopeDir(config?.rootDir ?? getDefaultBaseDir(), scope, scopeId);
    this.conflictThreshold = config?.conflictSimilarityThreshold ?? CONFLICT_SIMILARITY_THRESHOLD;
    migrateLegacyProjectScope(scope, scopeId, this.scopeDir);
    this.ensureDirectoryStructure();
  }

  private async withWriteLock<T>(operation: () => Promise<T> | T): Promise<T> {
    const release = acquireFileLock(join(this.scopeDir, '.write.lock'));
    try {
      return await operation();
    } finally {
      release();
    }
  }

  setConflictThreshold(threshold: number): void {
    this.conflictThreshold = threshold;
  }

  private ensureDirectoryStructure(): void {
    for (const state of ['active', 'deprecated', 'archived']) {
      ensureDir(getStateDir(this.scopeDir, state));
    }
    ensureDir(join(this.scopeDir, '.versions'));
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
    await this.withWriteLock(async () => {
      const stateDir = getStateDir(this.scopeDir, rule.state.value);
      const rulePath = getRulePath(stateDir, rule.id);
      try {
        atomicWriteFileSync(rulePath, JSON.stringify(rule, null, 2));
      } catch (err) {
        throw new Error(`Failed to save rule ${rule.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  async readRule(ruleId: string, state?: string): Promise<RuleNode | null> {
    const states = state ? [state] : ['active', 'deprecated', 'archived'];
    for (const s of states) {
      const rulePath = getRulePath(getStateDir(this.scopeDir, s), ruleId);
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
    return this.withWriteLock(async () => {
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
        const oldStateDir = getStateDir(this.scopeDir, rule.state.value);
        const newStateDir = getStateDir(this.scopeDir, updatedRule.state.value);
        const oldPath = getRulePath(oldStateDir, ruleId);
        const newPath = getRulePath(newStateDir, ruleId);

        ensureDir(newStateDir);
        atomicWriteFileSync(newPath, JSON.stringify(updatedRule, null, 2));
        if (existsSync(oldPath)) {
          rmSync(oldPath);
        }
      } else {
        const stateDir = getStateDir(this.scopeDir, rule.state.value);
        atomicWriteFileSync(getRulePath(stateDir, rule.id), JSON.stringify(updatedRule, null, 2));
      }

      return updatedRule;
    });
  }

  async listRules(params?: {
    domain?: Domain;
    state?: string;
    projectScope?: string;
  }): Promise<RuleNode[]> {
    const states = params?.state ? [params.state] : ['active', 'deprecated', 'archived'];
    const rules: RuleNode[] = [];

    for (const state of states) {
      const stateDir = getStateDir(this.scopeDir, state);
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
    const versionsDir = join(this.scopeDir, '.versions');
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
    atomicWriteFileSync(versionPath, JSON.stringify(versions, null, 2));
  }

  async getRuleHistory(ruleId: string): Promise<RuleVersion[]> {
    const versionPath = getVersionPath(join(this.scopeDir, '.versions'), ruleId);
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
}
