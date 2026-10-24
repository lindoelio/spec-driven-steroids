# Contributing

Contribute focused changes to the CLI, shipped templates, or landing page. Use [AGENTS.md](AGENTS.md#essential-commands) for setup and verification commands, [STYLEGUIDE.md](STYLEGUIDE.md) for code conventions, and [TESTING.md](TESTING.md) for test selection.

## Repository layout

```text
packages/
  cli/                 Public npm package
    src/cli/           Entry point, platform adapters, templates, install manifests
    src/commands/      Installation lifecycle and template-inspection commands
    src/core/validate/ Spec validators and shared validation helpers
    src/context-stewardship/ Local rule storage, retrieval, and lifecycle
    templates/         Shipped agents, commands, and skills
    tests/             Unit and integration suites
  test-utils/          Private shared filesystem helpers and fixtures
  landing-page/        Private Vite site
scripts/               Packaging and release helpers
.github/workflows/     Verification, publishing, and site deployment
.changeset/            Public-package release notes and versioning configuration
```

## Make a change

1. Start a focused branch from `main`, the configured Changesets base branch and CI push target.
2. Keep the change limited to one behavior or problem. Include a regression test when fixing a bug.
3. For platform or template changes, verify affected destinations, scopes, and emitted content in integration tests. Change universal sources rather than local installed copies.
4. Update documentation when behavior changes. Check both `README.md` and `packages/cli/README.md` for duplicated product instructions.
5. Run the relevant checks before opening a pull request and record their results.

Use descriptive commit messages. Recent history uses prefixes such as `feat:`, `test:`, and `chore(release):`; no commit-message validator is configured in the checked-in workflows.

## Pull requests and CI

Open pull requests against `main`. Explain the problem, the behavioral change, affected platforms or scopes, and how the result was verified. Identify intentional compatibility changes and any checks not run locally.

[CI](.github/workflows/ci.yml) runs on pull requests and pushes to `main`, using Node.js 20, 22, and 24. It checks:

- Type checking and builds
- Biome lint rules
- Tests and coverage thresholds
- Installation of the packed npm artifact
- Production dependency audit

Workflow configuration does not establish repository branch-protection settings. Do not assume a required approval count or signed-commit policy from these files.

## Changesets and publishing

Add a changeset for a release-worthy change to public CLI behavior or shipped templates:

```bash
pnpm changeset
```

Select `spec-driven-steroids`, the public package. Describe the effect on users rather than only listing implementation files. The root workspace, test utilities, and landing page are private.

The root versioning script runs Changesets and then synchronizes the root package version with the CLI package. Package publishing is triggered by `v*` tags; the workflow verifies the tag against the CLI version before publishing. Template assets have a separate workflow, triggered by release tags or manual dispatch. See [ARCHITECTURE.md](ARCHITECTURE.md#distribution-and-release-boundaries) for the distribution boundaries.

Creating a contribution does not require publishing, pushing tags, or deploying the site. Those are separate maintainer actions.

## Maintain documentation

Guidelines are ordinary Markdown and can be edited with any tool. Read existing content first, preserve valid policies and organization, and apply only justified corrections or material additions. Leave files untouched when no update is needed.

Keep agent instructions in [AGENTS.md](AGENTS.md), coding details in [STYLEGUIDE.md](STYLEGUIDE.md), testing guidance in [TESTING.md](TESTING.md), system boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), and security practices in [SECURITY.md](SECURITY.md). Prefer links over repeating full sections.

The optional planning workflow and its approval gates are described in [README.md](README.md#spec-flow). It is not a prerequisite for every contribution.
