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

Prepare the requested package version, commit the release, deliver it to `main`, create the matching `vX.Y.Z` tag on the verified commit, and push that tag so `.github/workflows/publish.yml` publishes to npm automatically.

Do not run `npm publish` or `pnpm publish` manually. Publication is done by GitHub Actions after the tag push.

Follow `CONVENTIONS.md#maintainer-delivery`. For the sole maintainer's authorized work, deliver directly to `main` using the owner's permitted admin bypass; do not introduce PR, code-owner, merge, or repeated release-approval gates. Preserve all validation, planning approvals, and safety permissions. This repository policy is not a rule to install into other projects.

## Required Inputs

- Resolve the target version from the request, approved release plan, or existing release preparation. The declared version in `VERSION` is the single source of truth; everything published derives from it.
- Ask one short clarification only if those sources do not determine the version unambiguously. Do not ask for release authorization again when it is already part of the approved scope.

## Successful Release Process

1. Inspect repository state.
   - Run `git status`.
   - Run `git diff --stat`.
   - Run `git log --oneline -10`.
   - Confirm the current branch and upstream state.
   - Confirm the authenticated GitHub actor and permissions under the maintainer-delivery policy.
   - Never revert or overwrite unrelated user changes.

2. Commit feature changes first, if any are present.
   - Inspect the changed files enough to write an accurate commit message.
   - Ensure user-facing platform additions are documented in the READMEs and later in the changelog.
   - Stage the intended non-release files with `git add`.
   - Commit them with a concise conventional message, for example `feat: add Cline platform support`.

3. Declare the target version.
   - Read `VERSION` at the repository root for the current version.
   - If the target version and changelog are already prepared, verify them and reuse that release commit; do not bump again.
   - Run `node scripts/set-version.mjs <target-version>`. A version with a `-next.N` suffix ships the native preview: the pipeline publishes it under the npm `next` dist-tag, marks the GitHub release as a prerelease, publishes the `templates-next` bundle, and skips the Homebrew formula and the distribution tree. A plain version ships the stable channel.
   - The script writes `VERSION`, the embedded copy under `internal/version/`, and the version of every package manifest. It is the single write path for the declaration.
   - Verify that `VERSION`, the embedded copy, `package.json`, `packages/cli/package.json` and the six platform packages all equal the target version.
   - Update `packages/cli/CHANGELOG.md` with the user-facing changes of this release. A `-next.N` release notes the preview channel and the stewardship removal; the stable release notes the promotion.

4. Check the release scope.
   - Confirm that the working tree holds only the intended release changes.
   - Confirm that the platform packages carry the release binaries and their digests, or note that the release pipeline builds them.

5. Validate before release commit.
   - Run `go build ./...`, `go vet ./...` and `go test ./...`.
   - Run `node scripts/pack-check.mjs` to check the published package shape and the installer trust boundary.
   - If validation fails, fix the issue before committing the release.

6. Commit the release bump.
   - Stage `VERSION`, `internal/version/VERSION`, the package manifests and `packages/cli/CHANGELOG.md`.
   - Commit with exactly `release: vX.Y.Z`, replacing `X.Y.Z` with the target version.

7. Integrate and validate the exact release commit on `main`.
   - Fetch `origin/main`, inspect any intervening commits, and integrate only authorized work with a fast-forward or normal merge. Never force-push or discard user changes.
   - Push `main` directly; no PR or manual merge is required for the authenticated owner. Report a successful admin-bypass warning and continue.
   - Wait for CI on the exact pushed commit. Fix in-scope failures before tagging; do not reuse another SHA's green status.

8. Tag the verified release commit.
   - Check for the tag both locally and on the remote. If it already identifies the intended commit, resume publication monitoring rather than recreating it; stop on a conflicting tag without moving it.
   - Recheck that the release commit's declared version matches the target.
   - Create an annotated tag on that exact `main` commit: `git tag -a vX.Y.Z <verified-commit> -m "release vX.Y.Z"`.

9. Push the tag and verify publication.
   - Send only the intended tag: `git push origin refs/tags/vX.Y.Z`.
   - Confirm the remote tag resolves to the verified release commit.
   - Monitor `.github/workflows/publish.yml` and `.github/workflows/publish-templates.yml` to completion; investigate failures instead of stopping after dispatch.
   - Verify `spec-driven-steroids@X.Y.Z` in the npm registry and the matching template manifest. A successful upload may still be processing; report that state accurately and never republish or move the tag to work around propagation delay.
   - For a `-next.N` tag, verify the npm `next` dist-tag (`npm view spec-driven-steroids dist-tags`), the `templates-next` release, and that `latest` still resolves the stable TypeScript package.

## Guardrails

- Do not skip the feature commit before the release commit when non-release changes exist.
- Do not tag before the version bump commit exists.
- Do not push a tag whose version does not match the declared version in `VERSION`.
- Do not use `git reset --hard`, `git checkout --`, or any destructive cleanup unless explicitly approved.
- Do not amend published commits unless explicitly asked.
- If the owner-authorized push succeeds with a protected-branch bypass warning, report it and continue. If rejected, stop with the actual blocker; do not silently weaken protection or substitute a PR gate for the authorized maintainer path.
