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

The CLI writes files to the filesystem during injection (templates, skills, agents, commands) and during knowledge graph operations (JSON rules under `~/.agents/stewardship/`). It does **not**:
- Access files outside its intended target directories
- Modify existing files other than `opencode.json` (schema injection only)
- Write to directories without explicit user confirmation (the `clean` command shows a preview and requests confirmation)

### Template Sources

The CLI supports two template sources:

1. **Remote templates**: Fetched over HTTPS. Content is copied to local directories after retrieval. Remote templates are preferred but always fall back to bundled templates on failure.
2. **Bundled templates**: Shipped in the npm package and verified by the npm integrity chain.

Both paths result in templates being written to local directories. No template content is executed — all files are plain text (Markdown, TOML).

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
