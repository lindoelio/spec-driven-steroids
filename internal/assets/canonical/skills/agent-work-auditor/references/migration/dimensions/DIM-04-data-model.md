# DIM-4: Data Model Alignment

**Question:** Does the new data model maintain equivalent structures?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | New schema is isomorphic to old — all entities, relationships, constraints equivalent |
| 4 | New schema equivalent with minor optimizations that don't affect behavior |
| 3 | New schema equivalent for core entities, some peripheral structures changed |
| 2 | New schema has meaningful structural differences |
| 1 | New schema fundamentally different, data migration incomplete |

## Audit Questions

1. Map every legacy table/collection/entity to its new equivalent
2. For entities NOT migrated, explain why
3. What data integrity constraints exist? Are they preserved?
4. How is denormalized data handled in the new model?

## Evidence Requirements

- Data model mapping document
- Constraint comparison (old vs new)
- Data migration validation results

## Auto-Fix

Cannot auto-fix — data model alignment requires human verification.

## Probing Questions

- "What is the schema for the users table in the legacy system?"
- "Are all foreign key relationships preserved?"
- "What happens to existing data during migration?"