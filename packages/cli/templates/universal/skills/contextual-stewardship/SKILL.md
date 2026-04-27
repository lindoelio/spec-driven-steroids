---
name: contextual-stewardship
description: Use this skill when the user makes a technical decision, establishes a new pattern, defines business rules, or explicitly asks to remember or save a guideline. Also use this skill when you are about to implement a feature, write code, plan an architecture, or make a technical decision - you MUST retrieve contextual memory first to follow established patterns. Acts as a Staff Engineer to extract, curate, and persist architectural decisions, business rules, and workflows into long-term memory using a JSON graph store.
---

# Contextual Stewardship Skill

You are acting as a Staff Engineer responsible for **Contextual Stewardship** — a knowledge graph system that captures, retrieves, and manages architectural decisions, business rules, and workflows across projects with full provenance tracking and lifecycle management.

## Core Concepts

### Domains

All rules are classified into one of **8 standard domains**:

| Domain | Description |
|--------|-------------|
| `architecture` | Tech stack choices, design patterns, ORM preferences, library decisions |
| `business` | Product rules, target audience, domain logic, business constraints |
| `workflow` | Git patterns, testing rules, naming conventions, team processes |
| `security` | Security policies, authentication patterns, data protection rules |
| `performance` | Performance budgets, caching strategies, optimization guidelines |
| `legal` | Compliance requirements, licensing constraints, regulatory rules |
| `team-structure` | Ownership, roles, responsibilities, escalation paths |
| `technical-debt` | Known debt items, refactoring priorities, modernization plans |

Custom domains are also supported — any string not in the standard list is accepted as a custom domain. Child domains inherit from their parent (e.g., `architecture.database` inherits from `architecture`).

### Lifecycle States

Rules transition through three states:

- **active** — Rule is currently in effect
- **deprecated** — Rule is superseded by another; `supersededBy` link is set
- **archived** — Rule is no longer relevant; preserved for historical reference

### Storage Backend

The system uses JSON file storage for all rule persistence:

| Backend | Storage Location |
|---------|-----------------|
| `json-graph` | `~/.agents/stewardship/{scope}/{state}/` JSON files |

---

## CLI Commands

All stewardship operations use the `sds stewardship` CLI command. Ensure `sds` (spec-driven-steroids) is installed and available in PATH.

```bash
sds stewardship <subcommand> [options]
```

### `retrieve` — Pre-flight Context Retrieval

**When to use:** Before implementing a feature, writing code, planning architecture, or making a technical decision. This is the **mandatory pre-flight check**.

**Behavior:**
1. Verify file system storage is available
2. Query the semantic retrieval engine with the current task keywords
3. Apply scope chain priority: **session → project → org → global**
4. Return rules scored by weighted keyword match (50%) + recency (30%) + confidence (20%)
5. Filter to `active` rules by default; surface `deprecated` rules with `supersededBy` link
6. Flag out-of-domain matches when no in-domain results exist

**Command:**
```bash
sds stewardship retrieve <query> [--domain <domain>] [--scope <scope>]
```

**Retrieval confirmation format:**
- "Retrieved N rules from `{domain}` domain via {tier}. Score breakdown: keyword={k}, recency={r}, confidence={c}."
- "No in-domain results — found {n} cross-domain matches (flagged [out-of-domain])."
- "Running in `{tier}` mode."

---

### `store` — Persist a Decision

**When to use:** When the user explicitly establishes a new pattern, makes a technical decision, or defines a business rule.

**Behavior:**
1. Validate domain (must be standard or accepted custom domain)
2. Auto-assign default expiration: **2 years** from now
3. Run conflict detection — flag rules with similarity > 0.85
4. If conflict: surface to agent for `override` / `merge` / `cancel` decision
5. On confirm: write rule node with full provenance (`source`, `sourceFile`, `decisionDate`, `author`, `originalText`)
6. Archive previous version on every update

**Command:**
```bash
sds stewardship store <domain> --content "<content>" [--author <name>]
```

**Persistence confirmation format:**
- "Rule `{ruleId}` saved to `{domain}` domain via {tier}. Expires: {date}. Provenance: {source}."
- "Conflict detected — similarity {score} with rule `{conflictId}`. Choose: override / merge / cancel."
- "Rule superseded link set: `{oldId}` → `supersededBy` → `{newId}`."

---

### `extract` — Auto-capture from Specs

**When to use:** After reading a `design.md` or `requirements.md` file. Automatically propose decision rules extracted from spec elements.

**Behavior:**
1. Parse `design.md`: extract DES-* headings, Mermaid technology mentions, `_Decisions:` blocks
2. Parse `requirements.md`: extract glossary terms, SHALL/MUST constraints, REQ-* bodies
3. Infer domain from content using keyword analysis
4. Dedupe by content hash (avoid storing exact duplicates)
5. Present candidates to agent for **explicit confirmation** before persisting
6. Store confirmed rules with provenance linking to spec file path and element ID

**Command:**
```bash
sds stewardship extract <file-path> [--author <name>]
```

**Extraction confirmation format:**
- "Found {n} extraction candidates from `{filename}`. Review required before persistence."
- Candidate format: `[{elementId}] {domain}: {content-preview...}`
- After confirmation: "Stored {n} rules from spec. Provenance: `{filename}#{elementId}`."

---

### `inject` — Phase Context Injection

**When to use:** Before entering a new spec-driven phase (requirements, design, tasks, implementation). Automatically retrieve and inject relevant context.

**Behavior:**
1. Map phase to relevant domains:
   - `requirements` → `business`, `workflow`
   - `design` → `architecture`, `security`, `performance`
   - `tasks` → `workflow`, `team-structure`
   - `implementation` → `architecture`, `technical-debt`
2. Query semantic engine for phase-relevant rules
3. Format as injected context block
4. Offer-to-capture: if a decision is made mid-phase, prompt to store it

**Command:**
```bash
sds stewardship inject <phase>
```

**Injection format:**
- "Phase `{phase}` context injected: {n} rules available from {domains}."

---

### `manage` — Lifecycle and Rule Management

**When to use:** When explicitly asked to list, deprecate, or archive rules.

**Commands:**
```bash
sds stewardship manage list [--scope <scope>]
sds stewardship manage deprecate --ruleId <rule-id>
sds stewardship manage archive --ruleId <rule-id>
```

---

### `capabilities` — Check Current Tier and Features

**When to use:** Debugging or verifying why a certain feature is unavailable.

```bash
sds stewardship capabilities
```

Output example:
```
Tier: tier2-json-graph
File System: available
Enabled Features: json-graph, semantic-retrieval, versioning, conflict-detection
```

---

### `trace` — Rule Lineage Lookup

**When to use:** When investigating the history or provenance of a specific rule.

```bash
sds stewardship trace <rule-id>
```

Returns: rule content, domain, state, full provenance, `supersededBy` link, and version history with timestamps and diffs.

---

## Pre-flight Retrieval Checklist

Before every implementation task, run through this checklist:

- [ ] `sds stewardship retrieve "<task keywords>"` — do we have existing rules?
- [ ] Check scope chain — are there project-specific overrides? (`--scope <project-id>`)
- [ ] Check for conflicts — does the new decision contradict an existing rule?
- [ ] Check deprecated rules — is there a `supersededBy` link to follow?
- [ ] `sds stewardship extract <spec-file>` if reading `design.md` or `requirements.md`

---

## Storage Backend

The system uses a single, file-based JSON graph storage backend:

- **Storage location**: `~/.agents/stewardship/{scope}/{state}/` where `{scope}` is `global`, `org`, or `project`, and `{state}` is `active`, `deprecated`, or `archived`
- **Version history**: `~/.agents/stewardship/{scope}/.versions/{ruleId}.json`
- **Format**: Individual JSON files per rule for easy inspection and version control
- **Conflict detection**: Enabled with similarity threshold of 0.85

---

## Confirmation Message Quick Reference

| Operation | Format |
|-----------|--------|
| retrieve (hit) | "Retrieved {n} rules from `{domain}` via {tier}." |
| retrieve (miss) | "No rules found for `{query}`. No context loaded." |
| store success | "Rule `{id}` saved to `{domain}` via {tier}. Expires: {date}." |
| store conflict | "Conflict ({score}) with `{id}`. Choose: override / merge / cancel." |
| extract | "Found {n} candidates from `{file}`. Review required." |
| inject | "Phase `{phase}` context injected: {n} rules from {domains}." |
| deprecate | "Rule `{id}` deprecated. Superseded by `{newId}`." |
| archive | "Rule `{id}` archived." |
