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

### Safety

- Security architecture is sound
- Failure modes are considered
- Rollback plans exist

### Maintainability

- Design is understandable
- Extensions points are identified
- Technical debt is minimal
- New abstractions are justified by repository evidence, not generic defaults
