# Migration Strategy

**Posture:** Cautious

## Primary Focus

- **Backward compatibility**: Is the change backward compatible?
- **Schema changes**: Are database migrations safe? Do they preserve data?
- **Rollback readiness**: Is there a tested rollback plan?
- **Migration tests**: Do tests cover the data path?

## Secondary Focus

- API/interface changes that break existing callers
- Dependency version conflicts
- Configuration changes affecting deployment

## Approval Threshold

For migration audits, ALL 8 dimensions must score 4+:
- DIM-1: Codebase Comprehension (4+)
- DIM-2: Behavioral Fidelity (4+)
- DIM-3: API/Interface Contract (4+)
- DIM-4: Data Model Alignment (4+)
- DIM-5: Side Effect Audit (4+)
- DIM-6: Edge Case Coverage (4+)
- DIM-7: Migration Inventory (4+)
- DIM-8: Silent Assumption Audit (4+)

**Any score below 4 blocks the migration.**

## What Blocks Approval

- Breaking backward compatibility without migration path
- Database schema change that loses data
- No rollback plan for destructive change
- Migration tests missing or inadequate
- Dependency upgrade introduces security vulnerability

## Phase 0 Gating

Before requirements gathering, Phase 0 (Codebase Inventory) must complete:

1. Scan legacy codebase
2. Catalog all components
3. Document all interfaces
4. Log all side effects
5. Obtain inventory approval

See `references/migration/phase-0-inventory.md` for workflow.

## Detailed Dimension Rubrics

See individual dimension files in `references/migration/dimensions/`:

- `DIM-01-comprehension.md` — Did agent read legacy code?
- `DIM-02-fidelity.md` — Does new match old exactly?
- `DIM-03-contract.md` — Are all interfaces preserved?
- `DIM-04-data-model.md` — Are schemas equivalent?
- `DIM-05-side-effects.md` — Are side effects replicated?
- `DIM-06-edge-cases.md` — Are undocumented edge cases handled?
- `DIM-07-inventory.md` — Did agent find ALL components?
- `DIM-08-assumptions.md` — What was assumed without verification?

## Prove-It Challenges

Before migration approval, the agent must demonstrate comprehension:

See `references/migration/prove-it-challenges.md` for verification prompts.