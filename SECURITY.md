# Security

This project installs files into developer tools and distributes instructions interpreted by AI agents. Review both filesystem effects and prompt trust when using or modifying it.

## Report a vulnerability privately

Do not publish working exploits, credentials, or private filesystem contents in a public issue. Contact the maintainer privately using the address published in the [package metadata](packages/cli/package.json): [lindoelio@gmail.com](mailto:lindoelio@gmail.com).

Include the information needed to reproduce the problem safely:

- CLI version and, when available, template version and source
- Operating system, target platform, and project or global scope
- A minimal reproduction using temporary directories and sanitized files
- Expected behavior, observed behavior, and impact

Coordinate public disclosure with the maintainer. No response-time commitment or supported-version/backport matrix is established by the checked-in release configuration; report the exact affected versions rather than assuming older releases are maintained.

## Filesystem and local data

Injection writes platform files and installation manifests. Use an isolated project or temporary home when experimenting. Global scope can change instructions shared by unrelated repositories.

Manifest-based cleanup compares installed-file hashes and skips modified files unless `--force` is supplied. Preserve this behavior when changing cleanup, and do not delete whole platform directories containing unrelated user files. The legacy cleanup path also needs preservation tests; it cannot rely on a modern install manifest being present.

Injection and repair can overwrite installed artifacts. In particular, repair re-emits templates and copies skills with overwrite enabled; it is not limited to filling missing files. Review local customizations before running it. The injection command supports a backup option, and filesystem-changing commands expose dry-run modes for previewing installation changes.

A dry-run is not a sandbox: template-source resolution may still access the network or populate its cache. Do not interpret it as permission to trust arbitrary source URLs or local manifests.

Install manifests, caches, and rule graphs are local files, not encrypted secret stores. Do not put tokens, credentials, private keys, or confidential customer data in templates, rule content, fixtures, or command output. Keep storage paths scoped and preserve the rule store's scope-ID validation, locking, and atomic-write behavior.

## Remote templates and host instructions

Remote templates are enabled by default. The source resolver checks bundle URLs, allowed hosts, schema/version compatibility, path containment, file-count and size limits, and a SHA-256 digest when the remote manifest supplies one. Cached files are rechecked against recorded hashes before reuse.

These checks have distinct limits:

- A digest detects a mismatch with the supplied manifest; it is not an independent signature authenticating the publisher
- Manifests without a digest are accepted with a warning for compatibility
- Custom manifest URLs and allowed-host overrides change the trust boundary
- Remote-resolution failures fall back to bundled templates rather than authorizing an invalid remote bundle

Use the explicit bundled source when remote instructions are not appropriate for the environment. Inspect template-source settings and the actual source selected before investigating an unexpected prompt.

The CLI copies prompt text; it does not execute that text as Node.js code. The host AI tool may interpret it and take actions with its own permissions. Prompt approval rules are not a replacement for the host's permission controls, human review, or filesystem isolation.

## Dependencies and release security

CI installs the lockfile with frozen dependency resolution, audits production dependencies, and verifies a packed installation. Dependabot is configured for weekly npm and GitHub Actions updates.

The public package requests npm provenance through `publishConfig`. The publishing workflow grants OIDC token permission and verifies the release tag against the package version. Preserve these checks when changing publication; do not commit publishing credentials or broaden workflow permissions without a specific need.

For changes to path validation, remote loading, cleanup, or rule storage, include negative tests demonstrating that invalid input cannot escape its intended boundary or remove unrelated data. Use [TESTING.md](TESTING.md#isolate-side-effects) for isolation practices.
