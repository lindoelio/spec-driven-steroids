# Library/SDK Checks

Public packages, SDKs, reusable components, and dependencies that other projects consume.

## Library Domain Signals

- `package.json` with `main` or `exports` field
- `README.md` at root with installation/usage docs
- `.npmignore` or `files` field in package.json
- `Cargo.toml` with `publish = true`
- PyPI package structure (setup.py, pyproject.toml)
- Go: `go.mod` with meaningful module path
- Maven/Gradle artifact coordinates

## Library-Specific Check Categories

### 1. Public API Surface

```
- All exported symbols documented
- No private/special symbols in public API
- Breaking changes detected (semver check)
- API is consistent (naming, patterns)
- Deprecated API marked with deprecation notice
- Examples provided for public functions
```

### 2. Semver Compliance

```
- Version follows semver (major.minor.patch)
- Breaking changes bump major version
- No new breaking changes in minor/patch
- Changelog updated for each release
- Tags match versions (v1.0.0, etc.)
```

### 3. Dependency Hygiene

```
- Minimal dependencies
- No circular dependencies
- Dev dependencies clearly separated
- Peer dependencies documented
- No transitive dependency conflicts
```

### 4. Documentation

```
- README with installation and usage
- API reference for all public symbols
- Migration guide for breaking changes
- License file present
- Type definitions included (.d.ts, pyi, etc.)
```

### 5. Publishing

```
- Package name is available (npm/pypi/etc.)
- No secrets in published package
- Files correctly included/excluded
- Metadata (version, description, keywords) correct
- Signing configured for releases
```

### 6. Compatibility

```
- Node.js version range specified
- Browser compatibility documented
- ESM/CJS dual support if needed
- Tree-shaking compatible (ES modules)
- Works in SSR/serverless environments
```

### 7. Cross-Domain Contamination Detection

**Critical for libs:** A library change can break any consumer domain.

```
When scanning a library, also check:
- All files in other domains (api/, src/, cli/, etc.) for imports from this lib
- package.json dependencies vs actual imports used
- Peer dependency misalignment
```

**Contamination pattern:**
```
libs/my-lib/index.ts exports: { capitalize, pluralize }
api/users.ts imports: { bcrypt, capitalize } from '@company/utils'
                                      ↑ NOT exported by lib!
```

**Check:** Scan all import statements across ALL domains to verify:
1. Every import from the lib resolves to an actual export
2. No imports of internal/private symbols
3. No missing dependencies in lib's package.json

## Quick Library Checks

Run these first (fast, high signal):

```bash
# npm
npm pack --dry-run  # Check files included
npm view .          # Check package metadata
npm ls --depth=0    # Check dependencies

# Cargo
cargo package --list  # Check files included
cargo publish --dry-run  # Check before publish

# Python
python -m build --sdist --no-isolation  # Test build
twine check dist/*   # Check package validity
```

## Library Check Examples

### Example: npm Package Check

```json
// package.json
{
  "name": "@company/my-utils",
  "version": "1.2.0",
  "description": "Common utilities for our projects",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "sideEffects": false,
  "engines": {
    "node": ">=16.0.0"
  }
}
```

**Check清单:**
- [ ] `main` field for CommonJS
- [ ] `module` field for ES modules
- [ ] `types` field for TypeScript
- [ ] `exports` for conditional exports
- [ ] `files` restricts published files
- [ ] `sideEffects: false` for tree-shaking
- [ ] `engines` specifies compatibility

### Example: Rust Crate Check

```toml
[package]
name = "my-utils"
version = "1.2.0"
edition = "2021"
description = "Common utilities"
license = "MIT"
repository = "https://github.com/company/my-utils"
documentation = "https://docs.rs/my-utils"
readme = "README.md"

[dependencies]
# Minimal deps - check: no unnecessary dependencies
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[dev-dependencies]
# Dev-only deps don't affect consumers
criterion = "0.5"

[package.metadata.docs.rs]
all-features = true
rustdoc-args = ["--cfg", "docsrs"]
```

**Check清单:**
- [ ] `edition` specified
- [ ] `repository` and `documentation` links present
- [ ] `readme` exists
- [ ] Minimal dependencies (no bloat)
- [ ] Dev deps separate
- [ ] docs.rs configuration for docs building

## Common Library Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| Breaking change | Consumer builds break | Semver enforcement |
| Missing types | TypeScript errors | Type definitions present |
| Missing exports | Import errors | All symbols exported |
| Too many deps | Dependency hell | Minimal dependency tree |
| Side effects | Tree-shaking fails | `sideEffects: false` |
| Wrong scope | Dev deps in prod | Dependencies vs devDependencies |
| Missing imports in consumers | Runtime errors | Cross-domain import verification |
| Undeclared deps | Works locally, fails in prod | Verify all imports have corresponding package.json entry |

## Required Fields for npm Publishing

**Required for npm:**
- `name` — valid scoped package name
- `version` — semver compliant
- `main` — CommonJS entry point

**Required for trust/transparency:**
- `license` — SPDX identifier
- `repository` — git URL

**Recommended for discoverability:**
- `description`
- `keywords`
- `author`
- `bugs`
