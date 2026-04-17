import { readFileSync, existsSync } from 'fs';
import type {
  RuleNode,
  Domain,
  ExtractionCandidate,
} from './types.js';
import { KnowledgeGraphStore } from './knowledge-graph-store.js';
import { hashString } from './utils.js';

// Patterns for extracting decisions
const DES_PATTERN = /^###\s+(DES-\d+):\s+(.+)$/gm;
const MERMAID_BLOCK_PATTERN = /```mermaid\n([\s\S]+?)```/g;
const DECISIONS_BLOCK_PATTERN = /_Decisions:([\s\S]+?)(?=\n##|\n#|$)/gi;
const TECHNOLOGY_PATTERNS = [
  // Databases
  /\b(PostgreSQL|MySQL|MongoDB|Redis|DynamoDB|Drizzle\s*ORM|Prisma|SQLite)\b/gi,
  // Languages/Frameworks
  /\b(Node\.?js|TypeScript|Python|Rust|Go|Svelte|React|Vue|Angular)\b/gi,
  // Cloud services
  /\b(AWS|Azure|GCP|S3|EC2|Lambda|Docker|Kubernetes)\b/gi,
  // Message queues
  /\b(RabbitMQ|Kafka|SQS|SNS)\b/gi,
  // Auth
  /\b(JWT|OAuth|SAML|LDAP|Passport)\b/gi,
];

const DEFAULT_DOMAIN: Domain = 'architecture';

export class SpecDecisionExtractor {
  private store: KnowledgeGraphStore;

  constructor(store: KnowledgeGraphStore) {
    this.store = store;
  }

  extractFromDesign(filePath: string, author = 'agent'): ExtractionCandidate[] {
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const candidates: ExtractionCandidate[] = [];

    // Extract from DES-* headings
    const desMatches = content.matchAll(DES_PATTERN);
    for (const match of desMatches) {
      const [, desId, title] = match;
      candidates.push({
        domain: this.inferDomain(title, content) ?? DEFAULT_DOMAIN,
        subDomain: undefined,
        content: `${desId}: ${title.trim()}`,
        provenance: {
          source: 'extract',
          sourceFile: filePath,
          decisionDate: new Date().toISOString(),
          author,
          originalText: title,
        },
        confidence: 0.7,
        sourceElement: desId,
      });
    }

    // Extract from Mermaid diagrams (technology mentions)
    const mermaidMatches = content.matchAll(MERMAID_BLOCK_PATTERN);
    for (const match of mermaidMatches) {
      const diagramContent = match[1];
      for (const techPattern of TECHNOLOGY_PATTERNS) {
        const techMatches = diagramContent.matchAll(new RegExp(techPattern.source, techPattern.flags));
        for (const techMatch of techMatches) {
          candidates.push({
            domain: 'architecture',
            subDomain: 'technology-choice',
            content: `Technology decision: ${techMatch[0]}`,
            provenance: {
              source: 'extract',
              sourceFile: filePath,
              decisionDate: new Date().toISOString(),
              author,
              originalText: techMatch[0],
            },
            confidence: 0.6,
            sourceElement: 'mermaid:technology',
          });
        }
      }
    }

    // Extract from explicit _Decisions: blocks
    const decisionMatches = content.matchAll(DECISIONS_BLOCK_PATTERN);
    for (const match of decisionMatches) {
      const blockContent = match[1];
      const lines = blockContent.split('\n').filter(l => l.trim().startsWith('-'));
      for (const line of lines) {
        const decisionText = line.replace(/^-\s*/, '').trim();
        if (decisionText) {
          candidates.push({
            domain: DEFAULT_DOMAIN,
            content: decisionText,
            provenance: {
              source: 'extract',
              sourceFile: filePath,
              decisionDate: new Date().toISOString(),
              author,
              originalText: decisionText,
            },
            confidence: 0.9, // Higher confidence for explicit markers
            sourceElement: '_Decisions:block',
          });
        }
      }
    }

    return this.dedupeCandidates(candidates);
  }

  extractFromRequirements(filePath: string, author = 'agent'): ExtractionCandidate[] {
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const candidates: ExtractionCandidate[] = [];

    // Extract glossary terms
    const glossaryMatch = content.match(/##\s+Glossary\n([\s\S]+?)(?=\n##|\n#|$)/i);
    if (glossaryMatch) {
      const glossaryContent = glossaryMatch[1];
      const termMatches = glossaryContent.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm);
      for (const match of termMatches) {
        const [, term, definition] = match;
        if (term && definition) {
          candidates.push({
            domain: 'business',
            subDomain: 'domain-terminology',
            content: `Term: ${term.trim()} = ${definition.trim()}`,
            provenance: {
              source: 'extract',
              sourceFile: filePath,
              decisionDate: new Date().toISOString(),
              author,
              originalText: `${term.trim()} = ${definition.trim()}`,
            },
            confidence: 0.8,
            sourceElement: `glossary:${term.trim()}`,
          });
        }
      }
    }

    // Extract constraint language (SHALL, MUST, REQUIRED)
    const constraintPattern = /\b(SHALL|MUST|REQUIRED|ESSENTIAL)\b[^\n.]*\.?/gi;
    const constraintMatches = content.matchAll(constraintPattern);
    for (const match of constraintMatches) {
      const constraintText = match[0].trim();
      if (constraintText.length > 10) {
        candidates.push({
          domain: 'business',
          subDomain: 'constraint',
          content: `Business constraint: ${constraintText}`,
          provenance: {
            source: 'extract',
            sourceFile: filePath,
            decisionDate: new Date().toISOString(),
            author,
            originalText: constraintText,
          },
          confidence: 0.7,
          sourceElement: 'requirements:constraint',
        });
      }
    }

    // Extract from requirement bodies (IF/WHEN/THEN patterns)
    const reqPattern = /^###\s+(REQ-\d+):[^\n]+\n([\s\S]+?)(?=^###|\n##\s|\n#\s|$)/gm;
    const reqMatches = content.matchAll(reqPattern);
    for (const match of reqMatches) {
      const [, reqId, reqBody] = match;
      // Extract business rules from acceptance criteria
      const businessRulePattern = /\b(BEFORE|AFTER|WHEN|IF|THEN)\b[^\n.]*\.?/gi;
      const ruleMatches = reqBody.matchAll(businessRulePattern);
      for (const ruleMatch of ruleMatches) {
        const ruleText = ruleMatch[0].trim();
        if (ruleText.length > 15) {
          candidates.push({
            domain: 'business',
            subDomain: 'business-rule',
            content: `${reqId}: ${ruleText}`,
            provenance: {
              source: 'extract',
              sourceFile: filePath,
              decisionDate: new Date().toISOString(),
              author,
              originalText: ruleText,
            },
            confidence: 0.6,
            sourceElement: reqId,
          });
        }
      }
    }

    return this.dedupeCandidates(candidates);
  }

  private inferDomain(title: string, _content: string): Domain | undefined {
    const lower = title.toLowerCase();

    if (/\b(security|auth|jwt|oauth|password|permission)\b/.test(lower)) {
      return 'security';
    }
    if (/\b(performance|latency|throughput|cache|optimization)\b/.test(lower)) {
      return 'performance';
    }
    if (/\b(legal|compliance|gdpr|privacy|regulatory)\b/.test(lower)) {
      return 'legal';
    }
    if (/\b(workflow|git|process|deployment|ci\/cd)\b/.test(lower)) {
      return 'workflow';
    }
    if (/\b(architecture|design|system|module|service|api)\b/.test(lower)) {
      return 'architecture';
    }
    if (/\b(business|product|requirement|feature)\b/.test(lower)) {
      return 'business';
    }

    return undefined;
  }

  private dedupeCandidates(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
    const seen = new Map<string, ExtractionCandidate>();
    for (const c of candidates) {
      const key = `${c.domain}:${hashString(c.content)}`;
      if (!seen.has(key)) {
        seen.set(key, c);
      }
    }
    return Array.from(seen.values());
  }

  async storeCandidate(
    candidate: ExtractionCandidate,
    projectScope?: string
  ): Promise<RuleNode> {
    const rule = this.store.createRule({
      domain: candidate.domain,
      subDomain: candidate.subDomain,
      content: candidate.content,
      author: candidate.provenance.author,
      provenance: {
        source: candidate.provenance.source,
        sourceFile: candidate.provenance.sourceFile,
        decisionDate: candidate.provenance.decisionDate,
        author: candidate.provenance.author,
        originalText: candidate.provenance.originalText,
      },
      metadata: {
        confidence: candidate.confidence,
        expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['extracted', candidate.sourceElement],
      },
      projectScope,
    });

    await this.store.saveRule(rule);
    return rule;
  }
}
