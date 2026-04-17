---
name: universal-live-check
description: Universal live-check framework for coding agents. Executes incremental, deterministic validation across all software domains (CLI, backend, frontend, mobile, embedded, libs). Change-type-aware (feat, fix, hotfix, refactor, migrate, docs). Triggers whenever an agent needs to validate code quality, run linting, perform pre-commit checks, verify builds, or validate changes in real-time. Use this skill for live validation during coding, pre-commit hooks, CI pre-flight checks, and rapid feedback loops.
---

# Universal Live Check Framework

Validate code changes in real-time with domain-adaptive, change-type-aware checks.
Every check is incremental (only validates what changed), fast (<2s), and deterministic.

## Gotchas

**Generic checks miss domain bugs:** A TypeScript-only check will miss Docker misconfigurations,
missing environment variables, or mobile-specific API level issues. Always detect the domain first.

**Blocking on slow checks kills flow:** Live checks must be fast. Offload heavy checks (integration
tests, full test suites) to async pipelines. Live checks verify immediately-correctable issues.

**Change type changes strategy:** A `hotfix` needs minimal validation to unblock deployment.
A `feat` needs full API contract verification. Always determine change type before selecting checks.

**Scope creep in libs:** Library changes affect downstream consumers. A `libs` domain check must
verify public API surface and semver compliance even for "minor" changes.

## Quick Start

```text
Input:  Files changed (or files to check), optional change type (feat|fix|hotfix|refactor|migrate|docs)
Output: Structured check report with pass/fail per check category

Workflow:
1. Classify domain(s) affected by the change
2. Determine change type via branch/commit/message analysis
3. Select checks per domain + change type
4. Run incremental checks (file-level first, then module-level)
5. Aggregate results into structured report
6. If failures: provide specific fix actions, not just symptoms
```

## Activation

Load this skill when:

- User asks for live checks, lint validation, or code quality checks
- User mentions pre-commit, pre-push, or CI pre-flight
- Agent is about to complete a coding session and needs validation
- User asks to "verify", "check", "validate", or "test" code changes
- User asks to "run checks" or "check my work"
- Agent detects domain change (CLI→backend, frontend→mobile, etc.)

Do NOT load this skill for:

- Running full test suites (delegate to CI async pipeline)
- Questions about code without validating anything
- Already-passed checks that don't need re-running

## Domain Classification

Detect affected domains by analyzing file paths, package manager files, and project structure.

### Domain Detection Algorithm

```
1. Scan changed files for domain signals
2. Check for project config files:
   - package.json → frontend, libs, or CLI
   - pyproject.toml / requirements.txt → backend
   - Cargo.toml → embedded or libs
   - docker-compose.yml / Dockerfile → backend
   - android/ or ios/ directories → mobile
   - Makefile / *.c / *.h → embedded
3. Combine signals,权重 domain confidence
4. Return ordered list of domains with confidence scores
```

### Domain Signal Map

| Signal | Domain | Examples |
|--------|--------|----------|
| `package.json` + web framework | frontend | React, Vue, Svelte, Next.js |
| `package.json` + CLI tool | CLI | commander, yargs, inquirer |
| `bin/` or `cli/` directory | CLI | Command-line tools |
| `pyproject.toml` / `requirements.txt` | backend | Django, FastAPI, Flask |
| `Cargo.toml` + no web framework | embedded | Rust bare-metal |
| `Cargo.toml` + web framework | libs | Rust web libraries |
| `Dockerfile` / `docker-compose.yml` | backend | Container configs |
| `android/` / `ios/` directories | mobile | React Native, Flutter |
| `Makefile` + `.c` / `.h` files | embedded | C/C++ firmware |
| `go.mod` | backend | Go services |
| `.npmignore` + `README.md` at root | libs | npm packages |

### New Addition Detection

For detecting NEW files/features (priority signals):
- `bin/` directory with executable files → `feat` (new CLI tool)
- `cli/` path prefix → `feat` (new CLI tool)
- New API routes in `api/` → `feat` (new endpoint)
- New components in `components/` → `feat` (new UI feature)
- First file in a new directory → `feat` (new module)

### Multi-Domain Detection

Most changes affect multiple domains:
- `api/` + `ui/` changes → backend + frontend
- `lib/` + `cli/` changes → libs + CLI
- `server/` + `mobile/` changes → backend + mobile

Always run checks for ALL detected domains.

## Change Type Detection

Detect the change type in priority order:

1. **Explicit tag:** User provides type tag (`feat`, `fix`, `hotfix`, `refactor`, `migrate`, `docs`)

2. **Branch name scan:** Check branch for conventional-commit prefixes:
   - `feat/` → `feat`
   - `fix/` → `fix`
   - `hotfix/` → `hotfix`
   - `refactor/` → `refactor`
   - `chore/` → `migrate`
   - `docs/` → `docs`

3. **Commit message scan:** Examine last 5 commit messages for prefixes (`feat:`, `fix:`, etc.)

4. **Heuristic inference:** Analyze diff size, files changed, and message language:
   - Large diff + many files → `migrate` or major `feat`
   - Few files + "fix" language → `fix`
   - "emergency" / "production down" → `hotfix`

5. **File path patterns:** Analyze file paths for change type signals:
   - `cli/`, `bin/` → `feat` (new tool)
   - `api/`, `routes/` + new file → `feat` (new endpoint)
   - `components/` + new file → `feat` (new component)
   - `fix/`, `bug/` in path → `fix`
   - `hotfix/`, `patch/` → `hotfix`
   - `migrate/`, `upgrade/` → `migrate`

6. **Change size heuristics:** Scale validation depth by change scope:
   - Single file, small change → focused check on affected lines
   - Multiple files → cross-file integration checks
   - New directory/first commit → full domain validation
   - 10+ files changed → check for scope creep and missing tests

7. **Fallback:** If no signal, use `feat` (most common, full validation)

### Change Type Strategies

| Type | Validation Scope | Speed | Blockers |
|------|-----------------|-------|----------|
| `feat` | Full validation, API contracts, tests | Medium | All errors |
| `fix` | Regression check, affected area, no new issues | Fast | All errors |
| `hotfix` | Minimal: build passes, core logic correct | Fast | Only blockers |
| `refactor` | Behavior preserved, no logic change | Medium | Logic errors only |
| `migrate` | Compatibility, deprecation warnings, data | Slow | Breaking changes |
| `docs` | Links valid, formatting correct | Fast | Broken links |

## Universal Check Categories

These checks apply to ALL domains:

### 1. Build Integrity (Universal)

```
- File syntax is valid (parse error check)
- Dependencies are resolvable
- Required env vars are defined (not necessarily set)
- Config files are valid (JSON/YAML/TOML parse)
```

### 2. Naming & Conventions (Universal)

```
- File naming follows project conventions
- Exported symbols follow naming conventions
- No debug/console logs left in production code
- No TODO/FIXME comments without tracking issue
```

### 3. Security Surface (Universal)

```
- No hardcoded secrets (API keys, passwords, tokens)
- No SQL/command injection vectors
- Input validation present on boundaries
- Authentication/authorization checks on endpoints
```

### 4. Error Handling (Universal)

```
- All errors are caught or propagated
- Error messages don't leak internals
- Resource cleanup in finally/defer blocks
- No empty catch blocks swallowing errors
```

### 5. Testing Surface (Universal)

```
- New code has corresponding tests
- Tests are not just stubs (assertions present)
- Test file naming follows convention
```

### 6. Cross-Domain Contamination (Universal)

When multiple domains detected, check for cross-boundary issues:

```
- Imports between domains (libs → backend → frontend)
- Shared config affecting multiple outputs
- Peer dependencies misaligned with actual usage
- Type mismatches across domain boundaries
```

## Domain-Specific Checks

Read the relevant reference file for domain-specific checks:

- [CLI Checks](references/cli-checks.md) — Command-line tool validation
- [Backend Checks](references/backend-checks.md) — API, database, service checks
- [Frontend Checks](references/frontend-checks.md) — UI, accessibility, bundle
- [Mobile Checks](references/mobile-checks.md) — iOS/Android specific validation
- [Embedded Checks](references/embedded-checks.md) — Hardware, memory, cross-compile
- [Libs Checks](references/libs-checks.md) — Public API, semver, compatibility, cross-domain deps

**Cross-domain detection is a key differentiator.** When a `libs` check finds backend code importing a library function, that's a signal to also run backend checks on that file.

## Check Execution Engine

### Hierarchical Validation

```
Level 1: File-level (instant, ~10ms per file)
├── Syntax parse check
├── Naming convention check
├── No secrets scan (regex)
└── Import/resolution check

Level 2: Module-level (~100ms per module)
├── Type check (if applicable)
├── Unused export check
├── Dependency graph check
└── API contract check

Level 3: Project-level (~1s total)
├── Build/compilation check
├── Config consistency check
└── Integration surface check
```

### Incremental Check Optimization

Only run checks affected by the changed files:

1. **File changed** → Run Level 1 for that file
2. **API file changed** → Run Level 2 for that module
3. **Config file changed** → Run Level 3 for project
4. **Multiple files** → Parallelize by file, aggregate results

### Cross-Domain Contamination Detection

**Critical for libs/domain packages:** Changes in one domain can break another.

Run these checks when multiple domains are detected:

```
libs/consumer.ts imports backend/api.ts → Verify api.ts hasn't changed
frontend/page.tsx imports mobile/App.tsx → Flag cross-import
lib/utils.ts used in cli/wordcount.ts → Check lib doesn't break CLI
```

**Signs of contamination:**
- Import chain crosses domain boundaries
- Shared utilities used by multiple domains
- Config files that affect multiple outputs

When found: validate BOTH the changed file AND its consumers.

### Check Result Format

```json
{
  "domain": "backend",
  "change_type": "feat",
  "checks_run": 12,
  "passed": 10,
  "failed": 2,
  "results": [
    {
      "check": "api-contract",
      "level": "module",
      "status": "pass",
      "file": "api/users.rs",
      "message": "All endpoints have schema definitions"
    },
    {
      "check": "secrets-scan",
      "level": "file",
      "status": "fail",
      "file": "config/development.env",
      "line": 3,
      "message": "Potential API key hardcoded",
      "fix": "Move to environment variables or .env file"
    }
  ],
  "execution_time_ms": 847
}
```

## Self-Healing Loop

For failed checks with auto-fix capability:

1. **Attempt fix** using known patterns
2. **Re-run check** to verify fix
3. **If still failing:** Mark as requires-attention, continue
4. **After session:** Report all unfixable issues with specific remediation steps

Never skip checks because auto-fix isn't available. Always report findings.

## Reporting

### Structured Report Format

```markdown
# Live Check Report

**Domain:** backend | **Change Type:** feat
**Files:** 5 changed | **Checks:** 12 run | **Time:** 847ms

## Summary

| Status | Count |
|--------|-------|
| ✅ Passed | 10 |
| ❌ Failed | 2 |
| ⚠️ Warnings | 1 |

## Failed Checks

### 1. secrets-scan (HIGH)
**File:** `config/development.env:3`
```env
API_KEY=sk_live_abc123  # ← hardcoded secret
```
**Fix:** Move to environment variables, use `.env.example` template

### 2. api-contract (MEDIUM)
**File:** `api/users.rs:45`
**Issue:** Response schema missing `email` field for `User` type
**Fix:** Add `email: string` to `UserResponse` schema

## Warnings

- `test_users.rs:12` — Test assertion too broad (consider using exact match)

## Cross-Domain Findings

When contamination detected between domains:

```
**Contamination:** `libs/utils.ts` used by `api/users.ts`
**Issue:** `api/users.ts` imports `bcrypt` but `utils` doesn't export it
**Check:** Verify all imports are resolvable across domain boundaries
```

## Next Steps

1. Fix 2 failed checks above
2. Run full test suite: `cargo test`
3. Verify build: `cargo build --release`
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Checks failed (with fixable issues) |
| 2 | Checks failed (with unfixable issues) |
| 3 | Domain detection failed (unknown project type) |

## Performance Targets

| Level | Target | Max |
|-------|--------|-----|
| File-level | <50ms | <100ms |
| Module-level | <200ms | <500ms |
| Project-level | <2s | <5s |
| Full run | <5s | <10s |

If checks exceed max time, abort and report partial results with warning.
