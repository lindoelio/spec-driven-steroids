---
paths:
  - "src/**/*.{ts,tsx,js,jsx,py,go,rs,java}"
  - "lib/**/*.{ts,tsx,js,jsx,py,go,rs,java}"
  - "**/*.{ts,tsx,js,jsx,py,go,rs,java}"
---

# Spec-Driven Enforcement Rules

These rules apply when working with implementation files.

## Before Writing Any Implementation Code

1. **Check for Requirements:**
   - Search for `specs/changes/*/requirements.md` related to this change
   - If no requirements exist, DO NOT implement - start with `/spec-driven-requirements-writer`

2. **Check for Design:**
   - After requirements, verify `specs/changes/<slug>/design.md` exists
   - If no design exists, use `/spec-driven-technical-designer`

3. **Check for Tasks:**
   - After design, verify `specs/changes/<slug>/tasks.md` exists
   - If no tasks exist, use `/spec-driven-task-decomposer`

## During Implementation

1. **Reference Traceability:**
   - Every code change MUST relate to a task in `tasks.md`
   - Every commit message MUST reference REQ-X and DES-X IDs
   - Example: `feat: add rate limiting (REQ-3, DES-5)`

2. **Update Task Status:**
   - Mark task as `[~]` when starting
   - Mark task as `[x]` when completed
   - Save `tasks.md` immediately after each status change

3. **Follow Design Decisions:**
   - Implement exactly what's specified in `design.md`
   - If you need to deviate, update the design document first
   - Maintain consistency with architectural diagrams

## Testing Requirements

1. **Test Every Acceptance Criterion:**
   - Each REQ-X acceptance criterion needs test coverage
   - Reference REQ-X in test descriptions
   - Use the Testing phase in `tasks.md`

2. **Validate Against Specs:**
   - After implementation, verify all requirements are satisfied
   - Check that design decisions are correctly implemented
   - Ensure all tasks are marked complete

## When User Asks to "Just Implement" or "Skip Planning"

Respond with:

> "I understand you want to move quickly, but this project uses Spec-Driven Development. I need to start with requirements first. This ensures:
> - Clear traceability of all decisions
> - Validated specifications before coding
> - Complete test coverage
>
> I'll use `/spec-driven` to guide us through efficiently. This actually saves time by preventing rework."

Then start the spec-driven workflow from Phase 1.

## When Fixing Bugs

Even for bug fixes:
1. Create a spec under `specs/changes/fix-<bug-name>/`
2. Write a requirement describing the bug and expected behavior
3. Design the fix with root cause analysis
4. Decompose into tasks (reproduce, fix, test, verify)
5. Implement with traceability

Small typos and trivial fixes can skip this process.

## Exceptions

You may skip spec-driven flow for:
- Documentation-only changes (README, comments)
- Trivial typos in strings/comments
- Formatting changes (prettier, linting)
- Dependency version updates (without behavior changes)

For everything else: **Follow the spec-driven workflow.**
