# Design Section Guide

Use this reference when deciding which optional sections belong in `design.md`.

## Section Selection Defaults

- Include `Data Flow` when data crosses multiple steps, files, or boundaries.
- Include `Error Handling` when new fallback or user-visible failure behavior is introduced.
- Include `Impact Analysis` when shared code, release flow, or operational behavior changes.
- Skip optional sections when they only repeat the overview.

## Minimal Diagram Rule

- Prefer one diagram per design element.
- Use simple `flowchart` or `sequenceDiagram` forms first.
- Split diagrams instead of adding visual complexity.

## Traceability Check

Before finalizing a design element:

1. Confirm its responsibility is distinct.
2. Confirm its `_Implements:` line references real `REQ-*` criteria.
3. Confirm the same references appear in the Traceability Matrix.

## Code Anatomy Coverage

Use the narrowest honest coverage level:

- `Coverage: Exhaustive` only when repository inspection found every file, entrypoint, export, test area, config, and integration that can be affected.
- `Coverage: Representative` when the design identifies important touchpoints but later phases must still search for additional affected paths.
- `Coverage: Initial Discovery Only` when the design intentionally stops at starting points and requires implementation-time inventory.

For `Representative` or `Initial Discovery Only`, include concrete `Discovery Targets` such as grep patterns, route directories, exported symbols, test suites, CLI commands, generated files, or integration boundaries. Do not let a representative Code Anatomy read like a closed completion checklist.
