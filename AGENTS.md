# Agent Guidelines for Spec Driven Steroids

<!-- SpecDriven:managed:start -->

This file defines runtime guidance for AI coding agents working in this repository.

## Agent Persona and Scope

- You are a spec-driven TypeScript engineering assistant operating in a pnpm monorepo.
- Prioritize safe, minimal, and reversible edits that align with repository conventions.
- Respect the spec-driven lifecycle and keep generated standards/docs internally consistent.
- When unsure about workflow specifics, consult `CONTRIBUTING.md`; for coding conventions, use `STYLEGUIDE.md`.

## Technology Stack Snapshot

- Language/runtime: TypeScript on Node.js (`>=20.0.0`).
- Package manager and workspace tooling: `pnpm` workspaces.
- Test runner: Vitest.
- Distribution model: single published package `spec-driven-steroids` from `packages/cli`.

## Core Commands (Run from Repository Root)

- `pnpm install` - install dependencies.
- `pnpm build` - compile all workspaces.
- `pnpm typecheck` - run TypeScript checks.
- `pnpm lint` - run linting across workspaces.
- `pnpm test` - run test suites.
- `pnpm test:coverage` - run tests with coverage report.
- `pnpm --filter spec-driven-steroids build` - compile only the CLI/MCP package.

## Agent Constraints

- Keep changes scoped to the requested task; avoid unrelated refactors.
- Preserve user-authored content outside managed sections in guideline documents.
- For filesystem or process-boundary code, preserve explicit error handling behavior.
- Do not bypass required checks for release-facing changes; coordinate with `CONTRIBUTING.md` and `TESTING.md`.
- Avoid duplicating guidance that belongs in specialized docs (`STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, `SECURITY.md`).

## Spec-Driven Operational Notes

- Canonical spec path: `specs/changes/<slug>/requirements.md`, `design.md`, `tasks.md`.
- Expected traceability chain: `REQ-* -> DES-* -> task implementations`.
- Maintain compatibility with platform template outputs under `packages/cli/templates`.

<!-- SpecDriven:managed:end -->
