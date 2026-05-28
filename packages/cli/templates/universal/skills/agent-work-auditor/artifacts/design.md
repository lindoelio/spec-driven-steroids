# Artifact-Type Guidance: Design

Guidance for auditing design documents (architecture, technical specifications).

## What to Evaluate

### Completeness

- All required sections present
- Design elements are complete
- Diagrams are complete
- No truncated content

### Correctness

- Mermaid syntax is valid
- Design traces to requirements
- Implementation is feasible
- No contradictions

### Consistency

- Terminology matches requirements
- Diagram style is consistent
- Section structure is standard
- Repository Context Evidence shows guidelines, contextual memory, and inspected code patterns that shaped the design
- File placement, naming, and boundaries follow the recorded evidence

### Traceability

- Every DES traces to REQ
- Every file traces to DES
- No orphaned design elements
- Code Anatomy declares whether coverage is `Exhaustive`, `Representative`, or `Initial Discovery Only`
- Non-exhaustive Code Anatomy has concrete Discovery Targets and does not read like a closed completion checklist

### Safety

- Security architecture is sound
- Failure modes are considered
- Rollback plans exist

### Maintainability

- Design is understandable
- Extensions points are identified
- Technical debt is minimal
- New abstractions are justified by repository evidence, not generic defaults

## Red Team Questions (Confidence Gate)

When auditing design, adopt a rejector persona and answer these adversarial questions. You must find at least 3 plausible weaknesses before declaring confidence.

1. **Does this design actually solve the requirements, or just describe a solution?** If implemented exactly as written, would every acceptance criterion be satisfied? What would break?
2. **Are the Mermaid diagrams lying?** Do the diagrams match the text description? Are there nodes or edges in the diagram that have no corresponding design element or file?
3. **Is the traceability matrix complete or just decorative?** Does every DES-* map to at least one REQ-*? Does every REQ-* have at least one DES-* implementing it? Are there orphaned design elements?
4. **Would a new developer understand the file placement without asking?** Are the Code Anatomy entries specific enough? Is every file mapped to a DES-*? Are proposed paths labeled `New` and existing paths verified?
5. **Ignore the Code Anatomy.** Starting from requirements and a fresh code search, which other files, entrypoints, exports, tests, or integrations could be affected? If any plausible touchpoint exists outside Code Anatomy, is coverage non-exhaustive and is there a Discovery Target for it?
6. **Are failure modes and rollback considered?** What happens if the new component crashes on startup? Is there a rollback plan for deployments or migrations?
7. **Is the design over-engineered for the problem?** Are there abstractions that serve only one use case? Could the design be simpler while still meeting requirements?
