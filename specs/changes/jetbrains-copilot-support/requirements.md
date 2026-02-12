# Requirements — JetBrains GitHub Copilot support

## Introduction

Provide repository-side support for GitHub Copilot in JetBrains IDEs (IntelliJ
IDEA, PyCharm, WebStorm, Rider, etc.) using the same _no-install_ pattern
currently used for VS Code: add only markdown templates and configuration files
to the repository so developers can use Copilot Chat features and the
Spec-Driven workflows inside JetBrains IDEs without installing plugins or
extensions.

## Glossary

- JetBrains Copilot: GitHub Copilot integration inside JetBrains IDEs (IDE Chat
  / Copilot Chat).
- Slash command /prompt: Markdown-based Copilot Chat prompt files (e.g.,
  `.github/prompts/*.prompt.md`).
- Managed sections: `<!-- SpecDriven:managed:start -->` /
  `<!-- SpecDriven:managed:end -->` markers.

## Requirements

REQ-1 — Platform parity WHEN a repository contains Spec-Driven templates for VS
Code (e.g., `.github/prompts/*`, `.opencode/*`, `.agent/*`), THEN the repository
SHALL provide equivalent JetBrains-specific prompt/agent/workflow files so
JetBrains users get the same `/inject-guidelines` and `Spec Driven` experience
as VS Code users.

Acceptance Criteria 1.1 JetBrains folder and file naming convention is
documented and present in templates. 1.2 `/inject-guidelines` slash command
available in JetBrains Copilot Chat via a prompt file included in repository.
1.3 `Spec Driven` agent/workflow available as a read-only workflow file for
JetBrains (no IDE plugin required).

REQ-2 — No IDE installation WHEN adding JetBrains support, IF a developer opens
the repository in a JetBrains IDE, THEN there SHALL be no requirement to install
repository-specific plugins or extensions; all functionality must come from
Copilot Chat prompt files and repository templates.

Acceptance Criteria 2.1 All JetBrains integration artifacts are plain Markdown
or JSON config files added to the repository. 2.2 No shell scripts, binaries, or
IDE plugins are required to be installed to use the workflow.

REQ-3 — Reuse existing templates & CLI inject WHEN the CLI
`spec-driven-steroids inject` runs for a project including JetBrains as a
selected platform, THEN the CLI SHALL copy JetBrains templates from
`packages/standards` into a repository-local folder (recommended `.jetbrains/`),
and update any MCP config files where applicable.

Acceptance Criteria 3.1 `packages/standards` contains `templates/jetbrains/`
with prompts, agent/workflow shims, and skill pointers. 3.2 CLI inject adds
`.jetbrains/` with prompts and workflows and does not modify IDE installation.
3.3 Tests validate `.jetbrains/` presence for inject CLI when JetBrains
selected.

REQ-4 — Copilot prompt parity WHEN a slash-command exists for another platform
(e.g., `/inject-guidelines`), THEN an equivalent
`.jetbrains/prompts/*.prompt.md` SHALL be provided so JetBrains Copilot Chat
users can run the same slash commands.

Acceptance Criteria 4.1 `.jetbrains/prompts/inject-guidelines.prompt.md` mirrors
`.github/prompts/inject-guidelines.prompt.md` content and variables. 4.2 Prompt
filename and frontmatter are valid and recognized by Copilot Chat in JetBrains
(same `.prompt.md` convention).

REQ-5 — Documentation & examples WHEN JetBrains support is added, THEN the
repository README and relevant docs SHALL include JetBrains usage instructions,
example screenshots, and where to find the prompt files.

Acceptance Criteria 5.1 README contains a JetBrains section describing
`/inject-guidelines` usage and path to `.jetbrains/prompts`. 5.2 Tests or docs
include a short checklist verifying `no plugin required` and
`reload Copilot Chat` steps.

REQ-6 — Backwards-compatible templates WHEN JetBrains templates are added to
`packages/standards`, THEN they SHALL follow the same template structure used by
existing platforms (GitHub, Antigravity, OpenCode) and include managed-section
markers so the `inject` CLI can preserve local edits.

Acceptance Criteria 6.1 Templates include `agents/`, `prompts/`, and `skills/`
subfolders consistent with other platform templates. 6.2 Managed markers are
present in generated guideline files when CLI performs an update.

## Traceability

- Links to design and tasks will reference `REQ-1`..`REQ-6`.

## Non-functional constraints

- Must not require changes to Copilot server or JetBrains product — rely on
  existing Copilot Chat prompt file support.
- Keep template additions minimal and documented.

## Notes / Rationale

- Goal: parity of experience across supported IDEs while keeping distribution
  lightweight (markdown + templates).
- Proposed folder: `.jetbrains/` (consistent naming with other platform folders
  like `.opencode`, `.agent`, `.github`).
