# DIM-3: API/Interface Contract Verification

**Question:** Are ALL existing interfaces preserved?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | All internal and external interfaces preserved with exact signatures |
| 4 | All external interfaces preserved, minor internal restructuring |
| 3 | External interfaces preserved, some internal interfaces changed |
| 2 | Some external interfaces changed, migration guide provided |
| 1 | Critical interfaces changed or removed without migration path |

## Audit Questions

1. List every internal API interface in the legacy system
2. List every external API interface (public contracts)
3. For each changed interface, what is the migration path?
4. Are all endpoint signatures (parameters, return types, error codes) equivalent?

## Evidence Requirements

- Interface inventory with signatures
- Before/after signature comparison
- Migration path documentation for changed interfaces

## Auto-Fix

Cannot auto-fix — interface preservation requires human verification.

## Probing Questions

- "What is the full signature of the legacy auth API?"
- "Are the parameter types identical?"
- "What error codes does the old API return vs the new?"