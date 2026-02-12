# Design — JetBrains GitHub Copilot support

## Overview

This design describes how to provide GitHub Copilot parity for JetBrains IDEs
using repository-only artifacts (no IDE plugin). The design follows the
Spec-Driven constraints: repository templates, Copilot Chat prompt files, and
CLI injection behavior. All design elements reference the requirements in
`requirements.md`.

## System Architecture

```mermaid
flowchart TD
  Dev[Developer (JetBrains IDE)] -->|opens repo| Repo[Repository]
  Repo --> DotJet[.jetbrains/ templates]
  Repo --> MCP[(MCP Server)]
  Dev --> Copilot[Copilot Chat in JetBrains]
  Copilot -->|reads| DotJet
  Copilot --> MCP
  CLI[spec-driven-steroids CLI] -->|inject| Repo
  CLI --> Standards[packages/standards/templates/jetbrains]
  Standards --> Repo
  subgraph "Artifacts"
    Prompts[.jetbrains/prompts/*.prompt.md]
    Agents[.jetbrains/agents/*.agent.md]
    Skills[.jetbrains/skills/*/SKILL.md]
  end
  Repo --> Prompts
  Repo --> Agents
  Repo --> Skills
```

## Code Anatomy & Folder Layout

- `.jetbrains/` — top-level folder created by
  `spec-driven-steroids inject --platform=jetbrains`
  - `prompts/` — Copilot Chat prompt files (`*.prompt.md`) (slash commands)
  - `agents/` — read-only agent/workflow shims (markdown) for UX parity
  - `skills/` — references to universal skills (copy of `universal/skills` or
    pointers)
  - `commands/` _(optional)_ — command snippets or usage hints for JetBrains
    chat

Example generated files (managed sections present where appropriate):

- `.jetbrains/prompts/inject-guidelines.prompt.md`
  <!-- SpecDriven:managed:start --><!-- SpecDriven:managed:end -->
- `.jetbrains/agents/spec-driven.agent.md` (shim pointing to prompts)
- `.jetbrains/skills/project-guidelines-writer/SKILL.md` (copied from universal
  templates)

## Design Elements

- DES-1: JetBrains prompt parity — create
  `.jetbrains/prompts/inject-guidelines.prompt.md` that mirrors
  `.github/prompts/inject-guidelines.prompt.md`. → REQ-1, REQ-4

- DES-2: No-install distribution — ensure all artifacts are Markdown/JSON, no
  binaries or plugins included. → REQ-2

- DES-3: CLI integration — extend `spec-driven-steroids inject` to accept
  `jetbrains` platform and copy templates to `.jetbrains/`. Add CLI tests. →
  REQ-3

- DES-4: Agent/workflow shims — provide lightweight markdown agent/workflow
  files in `.jetbrains/agents/` that point users to the slash commands. These
  are read-only by convention and may be removed where prompt-only is preferred.
  → REQ-1, REQ-6

- DES-5: Standards templates — add `packages/standards/src/templates/jetbrains/`
  matching the structure used by other platforms (prompts, agents, skills). →
  REQ-3, REQ-6

- DES-6: Documentation & tests — update `README.md`, add README JetBrains
  section, and add CLI integration tests to verify `.jetbrains/` artifacts are
  created. → REQ-5

## Traceability Matrix

| Design ID | Requirement ID(s) |
| --------- | ----------------- |
| DES-1     | REQ-1, REQ-4      |
| DES-2     | REQ-2             |
| DES-3     | REQ-3             |
| DES-4     | REQ-1, REQ-6      |
| DES-5     | REQ-3, REQ-6      |
| DES-6     | REQ-5             |

## Acceptance Criteria (Design-level)

- All DES-X items implemented in templates and CLI behavior.
- Mermaid architecture diagram included and reviewed.
- `packages/standards` contains `templates/jetbrains/` and CLI inject copies
  files to `.jetbrains/`.
- Unit/integration tests added for CLI inject (verify presence of
  `.jetbrains/prompts/inject-guidelines.prompt.md`).

## Impact & Risks

- Low-risk: purely repository-level additions; no JetBrains product changes
  required.
- Risk: Copilot Chat support in JetBrains must accept `.prompt.md` files
  (assumed parity with VS Code). If differences exist, small prompt-format
  adjustments may be required.

## Implementation Notes

- Use existing `packages/standards` templates as canonical source; replicate
  GitHub prompt contents into JetBrains prompt file.
- Add CLI option selection `jetbrains` in `packages/cli/src/index.ts` and tests
  mirroring GitHub case.

<!-- SpecDriven:managed:start -->

## Implementation checklist (managed)

- [ ] Add `templates/jetbrains/` to `packages/standards`
- [ ] Add `.jetbrains/prompts/inject-guidelines.prompt.md` template
- [ ] Update `packages/cli` to support `jetbrains` selection in `inject` command
- [ ] Add integration test in `packages/cli/tests/integration` verifying
      `.jetbrains/` files
- [ ] Update `README.md` with JetBrains usage instructions and screenshots

<!-- SpecDriven:managed:end -->
