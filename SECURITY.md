<!-- SpecDriven:managed:start -->

# SECURITY.md

## Security Policy

Spec-Driven Steroids takes security seriously. This document outlines security practices and how to report vulnerabilities.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public issue**. Instead, report it privately:

1. Email **[lindoelio@gmail.com](mailto:lindoelio@gmail.com)** with a detailed description of the vulnerability.
2. Include steps to reproduce, affected versions, and potential impact.
3. Allow up to **5 business days** for an initial response.
4. Once resolved, the fix will be published in a release with an appropriate changelog note.

## Supported Versions

Only the latest published version receives security patches. Users should regularly update to the latest release:

```bash
npm update -g spec-driven-steroids
```

## Security Constraints

### File System Access

The CLI writes files to the filesystem during injection (templates, skills, agents, commands) and during knowledge graph operations (JSON rules under `~/.agents/stewardship/` or `$SDS_HOME/stewardship/`).

- Every injected file is recorded in an install manifest under `~/.config/spec-driven-steroids/installs/` (or `$SDS_CONFIG_DIR`).
- `clean`, `uninstall`, and `repair` operate only on files listed in that manifest. Files whose hashes differ after installation are skipped unless `--force` is provided.
- The CLI never deletes a non-empty platform directory wholesale. Legacy cleanup removes only known SDS-owned files and removes directories only when they are empty.
- Project scopes are sanitized before being used as directory names.
- The CLI modifies `opencode.json` only to add the schema field.

### Template Sources

The CLI supports two template sources:

1. **Remote templates** (default): fetched over HTTPS, restricted to approved hosts, bounded in time and size, and verified against a SHA-256 digest from the manifest when one is present. Version and schema compatibility are checked before use. Remote content is written to the local cache and then into agent directories.
2. **Bundled templates**: shipped in the npm package and verified by the npm integrity chain. Use `SDS_TEMPLATE_SOURCE=bundled` or `--templates bundled` to force this source.

Remote template content is plain text (Markdown, TOML) and is never executed by the CLI. It is, however, interpreted as instructions by AI tools, so the digest and compatibility checks are part of the security boundary. A manifest without a digest is accepted for backward compatibility but emits a warning.

Template cache locations are platform-specific (`~/Library/Caches` on macOS, `$XDG_CACHE_HOME` on Linux, `%LOCALAPPDATA%` on Windows) and can be overridden with `SDS_TEMPLATE_CACHE_DIR`. Cached bundles record a per-file digest when extracted and are re-hashed on reuse; a cache whose contents no longer match is re-downloaded before use.


### Knowledge Graph Storage

The stewardship knowledge graph stores user-authored architectural decisions as JSON files under `~/.agents/stewardship/`. These files:
- Are stored in user home directory (not system locations)
- Contain only user-supplied content and metadata
- Do not include secrets, tokens, or credentials by design
- Are scoped by global, organization, or project boundaries

### CLI Authentication

The CLI does **not** handle authentication. It delegates to platform-native authentication mechanisms (GitHub Copilot, Gemini, etc.). No tokens or credentials are collected, stored, or transmitted by this tool.

### Dependency Hygiene

- Dependencies are pinned via `pnpm-lock.yaml`
- `pnpm install --frozen-lockfile` is used in CI to prevent supply-chain drift
- npm publishes use [provenance attestation](https://docs.npmjs.com/generating-provenance-statements) to verify package authenticity
- The package manager version is locked in `package.json` (`packageManager` field)

## Reporting Process

```
Reporter → Email lindoelio@gmail.com → Triage (5 days) → Fix → Release → Public disclosure (optional)
```

<!-- SpecDriven:managed:end -->
