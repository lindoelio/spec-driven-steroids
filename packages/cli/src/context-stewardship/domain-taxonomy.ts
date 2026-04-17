import type { Domain, DomainHierarchyNode } from './types.js';
import { STANDARD_DOMAINS as DOMAINS } from './types.js';

const hierarchyMap = new Map<Domain, DomainHierarchyNode>();

function buildHierarchy(): void {
  for (const domain of DOMAINS) {
    hierarchyMap.set(domain, { domain, children: [] });
  }
}

buildHierarchy();

export function isStandardDomain(domain: string): domain is Domain {
  return DOMAINS.includes(domain as Domain);
}

export function isKnownDomain(domain: string): boolean {
  return isStandardDomain(domain) || hierarchyMap.has(domain as Domain);
}

export function registerDomain(domain: Domain, parent?: Domain): DomainHierarchyNode {
  if (!hierarchyMap.has(domain)) {
    const node: DomainHierarchyNode = { domain, parent, children: [] };
    hierarchyMap.set(domain, node);
    if (parent) {
      // Auto-register missing parent chain
      if (!hierarchyMap.has(parent)) {
        hierarchyMap.set(parent, { domain: parent, children: [domain] });
      }
      const parentNode = hierarchyMap.get(parent)!;
      if (!parentNode.children.includes(domain)) {
        parentNode.children.push(domain);
      }
    }
    return node;
  }
  return hierarchyMap.get(domain)!;
}

export function getDomainNode(domain: Domain): DomainHierarchyNode | undefined {
  return hierarchyMap.get(domain);
}

export function getChildDomains(parent: Domain): Domain[] {
  const node = hierarchyMap.get(parent);
  if (!node) return [];
  const children: Domain[] = [...node.children];
  for (const child of node.children) {
    children.push(...getChildDomains(child));
  }
  return children;
}

export function getParentDomains(domain: Domain): Domain[] {
  const node = hierarchyMap.get(domain);
  if (!node || !node.parent) return [];
  const parents: Domain[] = [node.parent];
  parents.push(...getParentDomains(node.parent));
  return parents;
}

export function searchDomains(query: string): Domain[] {
  const normalized = query.toLowerCase();
  const results: Domain[] = [];

  for (const [domain] of hierarchyMap) {
    if (domain.toLowerCase().includes(normalized)) {
      results.push(domain);
    }
  }

  for (const domain of getChildDomains(query as Domain)) {
    if (!results.includes(domain)) {
      results.push(domain);
    }
  }

  return results;
}

export function validateDomain(domain: string): { valid: boolean; suggestion?: Domain } {
  if (isKnownDomain(domain)) {
    return { valid: true };
  }

  const searchResults = searchDomains(domain);
  if (searchResults.length === 1) {
    return { valid: false, suggestion: searchResults[0] };
  }

  return { valid: false };
}
