# spec-driven-steroids

## 0.4.0

### Minor Changes

- Improve spec-driven template guidance by making test task names behavior-focused with traceability kept in `_Implements`, and default generated `TESTING.md` strategy to Testing Trophy when repository testing conventions are inconsistent.

## 0.3.1

### Patch Changes

- Add testing phase to task decomposition and change-type-aware design

  - Task Decomposer: mandatory Acceptance Criteria Testing phase with one test task per AC
  - Task Implementer: guidance for handling test tasks
  - Technical Designer: change type classification, section applicability guide, data flow diagrams
  - Fixtures: updated valid-complete-spec to include testing phase

## 0.3.0

### Minor Changes

- Consolidated `@spec-driven-steroids/mcp` and `@spec-driven-steroids/standards` into the main `spec-driven-steroids` package.
- CLI, MCP server, and templates are now distributed as a single npm package.
- Added `spec-driven-mcp` binary for running the MCP server directly.
- Eliminated cross-package resolution logic, fixing template and MCP path bugs in global installs.
- Simplified publishing workflow to a single package release.

## 0.2.0

### Minor Changes

- First stable release of Spec-Driven Steroids toolkit
