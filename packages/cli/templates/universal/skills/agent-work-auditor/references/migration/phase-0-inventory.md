# Phase 0: Codebase Inventory Workflow

**Gating:** Phase 0 must complete before requirements gathering for migrate-type changes.

## Purpose

Force systematic exploration of the legacy codebase BEFORE planning anything. Without complete inventory, requirements are built on sand.

## Workflow

```
1. SCAN
   └─ Run: glob **/* on legacy codebase
   └─ Output: Complete file listing

2. CATALOG
   └─ Classify each file by type (service, model, util, config, etc.)
   └─ Identify component boundaries
   └─ Output: Component registry

3. DOCUMENT
   └─ Document interfaces (APIs, function signatures)
   └─ Document data models (schemas, entities)
   └─ Output: Interface inventory, data model map

4. LOG
   └─ Observe and log side effects
   └─ Identify implicit behaviors
   └─ Note undocumented edge cases
   └─ Output: Side effect log, assumption log

5. APPROVE
   └─ Review inventory for completeness
   └─ Verify critical components were read
   └─ Sign off on inventory completion
   └─ GATE: Blocks requirements gathering until approved
```

## Inventory Template

```markdown
## Migration Inventory

**Legacy System:** {system-name}
**Total Components:** {n}
**Inventory Complete:** {timestamp}

### Component Registry

| ID | Component | Type | Files | Status | Notes |
|----|-----------|------|-------|--------|-------|
| MIG-001 | Auth Module | service | 12 | catalogued | No docs |
| MIG-002 | User API | endpoint | 8 | catalogued | — |

### Interface Inventory

| Interface | Signature | Location | Notes |
|-----------|-----------|----------|-------|
| auth/login | POST {email, pass} → {token} | auth/service.ts:42 | — |

### Side Effect Log

| Side Effect | Trigger | Location | Verified? |
|-------------|---------|----------|-----------|
| Logs to auth.log | User login | auth/service.ts:55 | [ ] |

### Assumption Log

| Assumption | Evidence | Verified? |
|-----------|----------|------------|
| Session expires in 24h | None | [ ] |

### Undocumented Components

| ID | Suspected | Evidence | Priority |
|----|-----------|----------|----------|
| UC-001 | Side effect in auth.ts | Unclear logging | HIGH |
```

## Gating Criteria

The inventory must satisfy:

1. **File listing complete** — No major directories skipped
2. **Component registry complete** — All significant modules catalogued
3. **Interfaces documented** — All external APIs captured
4. **Side effects logged** — All observable side effects recorded
5. **Assumptions documented** — No critical assumption left unstated