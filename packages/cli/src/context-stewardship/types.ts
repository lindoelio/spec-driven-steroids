// Core types for the Context Stewardship knowledge graph system

export type LifecycleValue = 'active' | 'deprecated' | 'archived';

export type CapabilityTier = 'tier2-json-graph';

export type Domain =
  | 'architecture'
  | 'business'
  | 'workflow'
  | 'security'
  | 'performance'
  | 'legal'
  | 'team-structure'
  | 'technical-debt'
  | string; // custom domains allowed

export type ConflictDecision = 'override' | 'merge' | 'cancel';

export interface Provenance {
  source: 'manual' | 'extract' | 'import';
  sourceFile?: string;
  decisionDate: string; // ISO-8601
  author: string;
  originalText: string;
}

export interface Metadata {
  confidence: number; // 0-1
  expiresAt: string; // ISO-8601
  tags: string[];
}

export interface LifecycleState {
  value: LifecycleValue;
  changedAt: string; // ISO-8601
  changedBy: string;
}

export interface RuleNode {
  id: string;
  domain: Domain;
  subDomain?: string;
  content: string;
  provenance: Provenance;
  metadata: Metadata;
  state: LifecycleState;
  supersededBy?: string;
  projectScope?: string;
  relations: string[]; // rule IDs
}

export interface RuleVersion {
  ruleId: string;
  version: number;
  timestamp: string; // ISO-8601
  changedBy: string;
  previousState: LifecycleState;
  diff?: string;
}

export interface RetrievalQuery {
  query: string;
  domain?: Domain;
  projectScope?: string;
  lifecycleState?: LifecycleValue;
  includeDeprecated?: boolean;
  limit?: number;
}

export interface ScoredRule {
  rule: RuleNode;
  score: number;
  isOutOfDomain?: boolean;
}

export interface RetrievalResult {
  rules: ScoredRule[];
  totalCount: number;
  query: RetrievalQuery;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingRules: Array<{
    rule: RuleNode;
    similarity: number;
  }>;
}

export interface ExtractionCandidate {
  domain: Domain;
  subDomain?: string;
  content: string;
  provenance: Provenance;
  confidence: number;
  sourceElement: string; // e.g., "DES-1", "REQ-1.1", "glossary:TermName"
}

export interface CapabilityReport {
  tier: CapabilityTier;
  fileSystemAvailable: boolean;
  enabledFeatures: string[];
}

export interface DomainHierarchyNode {
  domain: Domain;
  parent?: Domain;
  children: Domain[];
}

export const DEFAULT_EXPIRATION_YEARS = 2;
export const CONFLICT_SIMILARITY_THRESHOLD = 0.85;

export const STANDARD_DOMAINS: Domain[] = [
  'architecture',
  'business',
  'workflow',
  'security',
  'performance',
  'legal',
  'team-structure',
  'technical-debt',
];
