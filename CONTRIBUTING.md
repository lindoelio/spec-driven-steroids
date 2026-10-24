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

1. Start from up-to-date `main`, the configured Changesets base branch and CI push target. External contributions use a focused branch; maintainer-owned work follows the direct-delivery policy below.
2. Keep the change limited to one behavior or problem. Include a regression test when fixing a bug.
3. For platform or template changes, verify affected destinations, scopes, and emitted content in integration tests. Change universal sources rather than local installed copies.
4. Update documentation when behavior changes. Check both `README.md` and `packages/cli/README.md` for duplicated product instructions.
5. Run the relevant checks before pushing maintainer work or opening a pull request and record their results.

Use descriptive commit messages. Recent history uses prefixes such as `feat:`, `test:`, and `chore(release):`; no commit-message validator is configured in the checked-in workflows.

## Maintainer delivery

This repository has one maintainer, `lindoelio`. For the maintainer's own work, including agents acting on the maintainer's authorized request, direct delivery to `main` is the default. This is standing authorization to commit and push the requested, verified changes without a PR, code-owner approval, or a manual merge. Use a PR only if the maintainer explicitly requests one; third-party contributions retain the PR process below.

- Confirm the authenticated GitHub actor is `lindoelio` with the necessary repository permissions. Commit authorship alone is not authorization; never change author metadata or credentials to qualify unrelated work for this exception.
- Inspect the working tree and remote state, preserve unrelated changes, and update from `origin/main` without rewriting history. If work is already on a branch, inspect its commits and integrate only authorized work through a normal fast-forward or merge; a PR is not required.
- Complete self-review and relevant local checks before pushing. After pushing, observe CI for the exact `main` commit. Fix in-scope failures and continue; never skip failed checks or claim success from a different commit's run.
- When a release or deployment is part of the request or approved plan, complete that scope autonomously: integrate, push, observe CI, tag the verified release commit when applicable, monitor publication/deployment, and verify the published result. Do not ask the maintainer to approve the same release again at PR, merge, tag, or deployment steps.
- Use the owner's permitted admin bypass when branch protection requires PR reviews but exempts admins. A successful push with a bypass warning is expected for this path; report it and continue. Do not disable protections for other contributors. If the server actually rejects the push, report the blocker rather than forcing history or changing protections silently.
- This exception removes redundant delivery approvals, not planning approvals, host safety permissions, or scope boundaries. A code-only request does not authorize an unrequested release. Repository-only documentation changes do not require a package version or release tag.

## Pull requests and CI

For third-party contributions or an explicitly requested PR, open it against `main`. Explain the problem, the behavioral change, affected platforms or scopes, and how the result was verified. Identify intentional compatibility changes and any checks not run locally.

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

Creating a contribution does not require publishing, pushing tags, or deploying the site. Those are maintainer actions; when included in an authorized delivery scope, follow [Maintainer delivery](#maintainer-delivery) without adding intermediate approval stops. Publish packages through the tag-triggered Actions workflow, never manual `npm publish`. Push the intended `main` commit and wait for its CI before sending the release tag; monitor the publication workflows and verify the exact version in the registry. Report registry processing delays separately from workflow success, and do not republish an accepted version just because it is not visible yet.

## Maintain documentation

Guidelines are ordinary Markdown and can be edited with any tool. Read existing content first, preserve valid policies and organization, and apply only justified corrections or material additions. Leave files untouched when no update is needed.

Keep agent instructions in [AGENTS.md](AGENTS.md), coding details in [STYLEGUIDE.md](STYLEGUIDE.md), testing guidance in [TESTING.md](TESTING.md), system boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), and security practices in [SECURITY.md](SECURITY.md). Prefer links over repeating full sections.

The optional planning workflow and its approval gates are described in [README.md](README.md#spec-flow). It is not a prerequisite for every contribution.
