---
name: release
description: Prepare and publish spec-driven-steroids through the tag-triggered npm release pipeline
mode: primary
agent: build
---

Release this repository using the established `spec-driven-steroids` publication flow.

User request / target version:

{{args}}

## Goal

Prepare the requested package version, commit the release, create the matching `vX.Y.Z` tag, and push with tags so `.github/workflows/publish.yml` publishes to npm automatically.

Do not run `npm publish` or `pnpm publish` manually. Publication is done by GitHub Actions after the tag push.

## Required Inputs

- Target version, for example `0.14.0`.
- If the target version is missing or ambiguous, ask one short clarification question before changing files.

## Successful Release Process

1. Inspect repository state.
   - Run `git status`.
   - Run `git diff --stat`.
   - Run `git log --oneline -10`.
   - Confirm the current branch and upstream state.
   - Never revert or overwrite unrelated user changes.

2. Commit feature changes first, if any are present.
   - Inspect the changed files enough to write an accurate commit message.
   - Ensure user-facing platform additions are documented in the READMEs and later in the changelog.
   - Stage the intended non-release files with `git add`.
   - Commit them with a concise conventional message, for example `feat: add Cline platform support`.

3. Create a Changesets entry for the target version.
   - Read `packages/cli/package.json` to determine the current version.
   - Choose the bump type needed to reach the target version: `patch`, `minor`, or `major`.
   - Add `.changeset/release-X-Y-Z.md` with this shape:

```md
---
"spec-driven-steroids": minor
---

Short release summary with the main user-facing changes.
```

4. Run the versioning command.
   - Run `pnpm changeset:version`.
   - Verify `packages/cli/package.json` and root `package.json` both equal the target version.
   - Inspect `packages/cli/CHANGELOG.md`; improve the generated entry if it omits important user-facing changes.

5. Validate before release commit.
   - Run `pnpm typecheck` at minimum.
   - If feasible, also run `pnpm build` and `pnpm test` before tagging.
   - If validation fails, fix the issue before committing the release.

6. Commit the release bump.
   - Stage `package.json`, `packages/cli/package.json`, and `packages/cli/CHANGELOG.md`.
   - Include any consumed changeset deletion if it appears in `git status`.
   - Commit with exactly `release: vX.Y.Z`, replacing `X.Y.Z` with the target version.

7. Tag the release.
   - Confirm there is no existing tag with `git tag --list vX.Y.Z`.
   - Create an annotated tag: `git tag -a vX.Y.Z -m "release vX.Y.Z"`.

8. Push to trigger publication.
   - Run `git push --follow-tags`.
   - Confirm the output pushed both the branch commit and the `vX.Y.Z` tag.
   - Tell the user that `.github/workflows/publish.yml` will build, test, check the published npm version, and publish `spec-driven-steroids@X.Y.Z` if it is not already published.

## Guardrails

- Do not skip the feature commit before the release commit when non-release changes exist.
- Do not tag before the version bump commit exists.
- Do not push a tag whose version does not match `packages/cli/package.json`.
- Do not use `git reset --hard`, `git checkout --`, or any destructive cleanup unless explicitly approved.
- Do not amend published commits unless explicitly asked.
- If GitHub rejects or warns about a protected branch rule but the push succeeds, report the warning and continue.
