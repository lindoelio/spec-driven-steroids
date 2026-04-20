# migrate — Migration / Dependency Upgrade

**Posture:** Cautious

**Full strategy:** See `references/migration/migrate-strategy.md`

**Quick reference:**
- Urgency: Medium-High
- Risk: High
- Primary: Backward compatibility, schema changes, rollback readiness

## Phase 0 Gating

**REQUIRED**: Before requirements gathering, Phase 0 (Codebase Inventory) must complete.

**Gating workflow:**
1. Scan legacy codebase (glob **/*)
2. Catalog all components and interfaces
3. Document side effects and data models
4. Log all assumptions
5. Obtain inventory approval (blocks requirements if incomplete)

**If Phase 0 is incomplete:**
- Migration audit is BLOCKED
- Display findings: "Phase 0 inventory required before requirements"
- Agent must complete inventory before proceeding

**For detailed migration auditing dimensions and Phase 0 workflow, see:**
- `references/migration/migrate-strategy.md` — Full migration posture
- `references/migration/dimensions/` — DIM-1 through DIM-8 rubric definitions
- `references/migration/phase-0-inventory.md` — Pre-requirements gating workflow
- `references/migration/prove-it-challenges.md` — Verification prompts