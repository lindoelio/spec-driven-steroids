# Distribution

This document names the destinations a release publishes to, how the release
pipeline reaches them, and which publication steps stay manual.

One declared version drives every channel. The version lives in the `VERSION`
file at the repository root; `scripts/set-version.mjs <version>` is the single
write path that updates it, the embedded copy of it, and the npm manifests. The
release pipeline refuses to publish anything when the release tag does not
match that declared version.

## The channels

| Channel | Destination | Publication |
| --- | --- | --- |
| GitHub Releases | `https://github.com/lindoelio/spec-driven-steroids/releases` | Automated: one standalone binary per supported operating system and architecture pair, plus the checksums of every asset |
| npm | `https://www.npmjs.com/package/spec-driven-steroids` | Automated: the platform packages first, then the main package |
| Homebrew | `https://github.com/lindoelio/homebrew-spec-driven-steroids` | Automated: the formula is rewritten and pushed by the release pipeline |
| Template bundle | The `templates-latest` release of this repository | Automated: the bundle the CLI resolves when it reads the templates remotely |
| AI tool marketplaces | `https://github.com/lindoelio/spec-driven-steroids-distribution` | Automated for the tree, manual for the vendor submissions and the topic registration |

## Release channels: latest and next

Two release lines share this pipeline. The tag decides the channel: a plain
tag (`v1.0.0`) ships the stable channel, a tag with a prerelease suffix
(`v1.0.0-next.0`) ships the native preview.

| | `latest` (stable) | `next` (native preview) |
| --- | --- | --- |
| npm dist-tag | `latest` | `next` |
| GitHub release | regular | prerelease |
| Template bundle | `templates-latest` | `templates-next` |
| Homebrew formula | updated | skipped |
| Distribution tree | pushed | skipped |

The `latest` line stays on the TypeScript implementation until the stable
native promotion. The `next` line carries the native binary without the
stewardship knowledge graph. Each line resolves its own template bundle, so
neither line can strand the other: the stable CLI keeps resolving the
14-skill `templates-latest`, the preview resolves the 13-skill
`templates-next`.

The npm jobs are gated by the `PUBLISH_NPM` repository variable. When it is
unset or `false`, a release publishes the GitHub binaries and the template
bundle and skips npm; the assets are the preview channel. Set it to `true`
and re-run the release workflow once the npm account owns the
`spec-driven-steroids` scope and the `NODE_AUTH_TOKEN` secret is in place, and
the same tag publishes the npm packages.

Rollback is additive: removing the `next` dist-tag unpublishes the preview
from the tag without touching `latest`, and the `templates-next` release can
be deleted or repointed without affecting `templates-latest`.

## Release precondition: the two external repositories

The Homebrew tap and the marketplace distribution repository live outside this
repository. Both are created once, by a maintainer, and both need a **named
owner** and **a first commit** before the first release that publishes to them.

| Repository | Owner | First commit |
| --- | --- | --- |
| `lindoelio/homebrew-spec-driven-steroids` | `lindoelio` | Required before the first release that updates the formula |
| `lindoelio/spec-driven-steroids-distribution` | `lindoelio` | Required before the first release that pushes the distribution tree |

The release pipeline pushes to both repositories, so a release that finds them
empty or missing fails at the publication step rather than silently skipping a
channel. Creating them is a maintainer task, not a pipeline task: the pipeline
never creates a repository.

The pipeline authenticates with three repository secrets:

| Secret | Used by |
| --- | --- |
| `NODE_AUTH_TOKEN` | The npm publication |
| `HOMEBREW_TAP_TOKEN` | The Homebrew formula update |
| `DISTRIBUTION_REPOSITORY_TOKEN` | The distribution tree push |

## Homebrew

- **Repository**: `lindoelio/homebrew-spec-driven-steroids`
- **URL**: https://github.com/lindoelio/homebrew-spec-driven-steroids
- **Formula reference**: `Formula/spec-driven-steroids.rb`

The formula is the installation channel for macOS and Linux. It references the
standalone binaries published with the GitHub Release, one URL and one checksum
per operating system and architecture pair:

```ruby
on_macos do
  on_arm do
    url "https://github.com/lindoelio/spec-driven-steroids/releases/download/v0.23.0/sds-darwin-arm64"
    sha256 "<the checksum published with the release>"
  end
  ...
end
```

The release pipeline updates it in the `homebrew` job of
`.github/workflows/publish.yml`. The job clones the tap, reads the checksums
from the published release, writes `Formula/spec-driven-steroids.rb` with the
version of the release and the checksum of every asset, and commits and pushes
the result to `main`. A release whose formula would not change is not
committed.

## The marketplace distribution repository

- **Repository**: `lindoelio/spec-driven-steroids-distribution`
- **URL**: https://github.com/lindoelio/spec-driven-steroids-distribution

The repository holds the **distribution tree**: the portable Agent Plugin
package, the vendor manifests, and the marketplace catalogs. The tree is
generated by the `sds package` command of the Go binary, which renders the
canonical artifacts into the portable package, emits the vendor manifests, and
writes the catalog each marketplace reads:

```bash
sds package \
  --out "$RUNNER_TEMP/distribution" \
  --owner lindoelio \
  --name spec-driven-steroids \
  --icon "https://opengraph.githubassets.com/1/lindoelio/spec-driven-steroids" \
  --category development
```

The tree is generated **outside the working tree of this repository**. This
repository ignores `.agents/`, so a tree generated inside it would silently
lose the Codex catalog at `.agents/plugins/marketplace.json` on commit. The
Gemini CLI extension manifest belongs at the root of the tree, because that
marketplace reads it from the absolute repository root.

The release pipeline pushes the tree in the `distribution` job of
`.github/workflows/publish.yml`: it generates the tree outside the working
tree, clones the distribution repository, replaces its content with the
generated tree, and commits and pushes the result to `main`.

### What the tree contains

| Path | Marketplace |
| --- | --- |
| `.claude-plugin/marketplace.json` | Claude Code, and Codex, which accepts the same path |
| `.agents/plugins/marketplace.json` | Codex, natively |
| `.cursor-plugin/marketplace.json` | Cursor |
| `plugins/{owner}/{name}/` | The MiniMax Code community registry: the package subtree, whose manifest is the portable one |
| `gemini-extension.json` | The Gemini CLI extension gallery, at the root of the tree |
| `plugin.json`, `skills/`, the vendor manifests | The portable Agent Plugin package every catalog references |

### Automated and manual marketplace steps

The `sds package` command reports the publication mode of every marketplace,
and the runbook below matches it.

| Marketplace | Mode | What it takes |
| --- | --- | --- |
| Claude Code | **Automated** | The catalog travels in the push of the distribution tree; a user adds the repository as a marketplace |
| Codex | **Automated** | The catalog travels in the same push |
| Cursor | **Manual** | The vendor reviews every submission: a vendor account, a submission form and a human review |
| MiniMax Code | **Manual** | The package reaches the community registry through a pull request that a vendor reviews. The archive carries `.minimax-plugin/plugin.json` at its root, so the root of the tree is the plugin and the folder is named after the plugin |
| Gemini CLI | **Manual** | The gallery discovers extensions through the `gemini-cli-extension` repository topic, and registering that topic is a one-time manual action |

The automated steps are the ones that need nothing but a git push of the
distribution tree. The steps that need a vendor account, a submission form or
a human review stay manual by design, and the pipeline does not attempt them.

## The release runbook

The publication happens on a tag, and the workflow refuses to publish a tag
that does not match the declared version. The steps below are the whole
release:

```bash
# 1. the version moves. The script is the single write path: it writes the
#    declaration, the copy the binary embeds, the npm manifests and the
#    captured version output.
node scripts/set-version.mjs 0.24.0

# 2. the change is committed.
git add -A
git commit -m "chore(release): v0.24.0"

# 3. the tag is pushed with the commit. The workflow starts on the tag.
git tag v0.24.0
git push origin main --tags
```

The workflow then publishes, in this order: the release assets with their
checksums, the platform packages, the main package, the Homebrew formula, the
template bundle and the distribution tree.

Before the tag, the continuous integration of the same commit has to pass. It
builds the module on Linux, macOS and Windows, runs the suite, runs the binary
on each of them, and checks the shape of the published packages.

## The npm channel

- **Main package**: `spec-driven-steroids` on https://www.npmjs.com/package/spec-driven-steroids
- **Platform packages**: `@lindoelio/sds-<npm-os>-<npm-cpu>` on https://www.npmjs.com

The main package carries the installer and a thin Node launcher; the CLI
itself is the native binary. It declares the platform packages as optional
dependencies, and the registry resolves exactly one of them for the host,
because each platform package declares the operating system and the
architecture it applies to in npm's own vocabulary:

| Platform package | `os` | `cpu` |
| --- | --- | --- |
| `@lindoelio/sds-linux-x64` | `linux` | `x64` |
| `@lindoelio/sds-linux-arm64` | `linux` | `arm64` |
| `@lindoelio/sds-darwin-x64` | `darwin` | `x64` |
| `@lindoelio/sds-darwin-arm64` | `darwin` | `arm64` |
| `@lindoelio/sds-win32-x64` | `win32` | `x64` |
| `@lindoelio/sds-win32-arm64` | `win32` | `arm64` |

The installer of the main package copies the binary out of the platform package
the registry resolved, verifies it against the digest published with that
package, and places it only when the digest matches. It performs no network
access of its own: the registry is the only transport. The digest is a
corruption check; the provenance controls are the publisher's attestation
(`npm publish --provenance`) and the release-time cross-check of the platform
package digest against the checksum published with the GitHub Release.

The publication order is asserted in the workflow itself: the platform packages
are published first, and the main package job depends on them and refuses to
publish while any of them is missing from the registry.

A release needs a version that the registry has never seen. The version
`0.23.0` is the TypeScript implementation, so the first release of the native
implementation carries a higher version. The workflow refuses to publish when
the declared version is already on the registry with a different shape, because
the registry does not let a published version change.

The scope belongs to the publisher account (`@lindoelio`), so npm publication
needs no organisation: the account that owns the scope can publish both the
main package and the platform packages. Two repository settings gate the npm
jobs, and both are needed before the first npm publication:

- the `NODE_AUTH_TOKEN` secret, holding a token with publish rights for
  `spec-driven-steroids` and the `@lindoelio` scope;
- the `PUBLISH_NPM` variable, set to `true`.

With either one absent, a release publishes the GitHub binaries and the
template bundle and skips npm; re-running the release workflow for the same tag
publishes the npm packages without a new tag, because the release and template
steps overwrite their own assets.

See [the installer documentation](../packages/cli/README.md#installing-the-binary-manually) for
the manual path, used when the installation scripts are disabled.
