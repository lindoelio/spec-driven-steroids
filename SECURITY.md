# SECURITY.md

> Security policy and practices for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Security Policy

### Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.7.x   | ✅ |
| < 0.7.0 | ❌ |

---

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Instead, report vulnerabilities privately:

1. Email: [lindoelio@gmail.com](mailto:lindoelio@gmail.com)
2. Subject: `[SECURITY] Spec-Driven Steroids Vulnerability`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 7 days |
| Fix Development | Varies by severity |
| Release | Within 30 days (critical) |

---

## Security Rules

### 1. No Secrets in Code

**Never commit:**
- API keys
- Tokens
- Passwords
- Private keys
- Database credentials

```typescript
// ❌ WRONG
const apiKey = 'sk-abc123...';

// ✅ CORRECT
const apiKey = process.env.API_KEY;
```

### 2. Input Validation

All user inputs must be validated before processing:

```typescript
function validateSlug(slug: string): boolean {
    if (!slug || typeof slug !== 'string') return false;
    if (slug.length > 100) return false;
    return /^[a-z0-9-]+$/.test(slug);
}
```

### 3. Path Traversal Prevention

Validate and sanitize file paths:

```typescript
import path from 'path';

function safePath(baseDir: string, userPath: string): string {
    const resolved = path.resolve(baseDir, userPath);
    if (!resolved.startsWith(baseDir)) {
        throw new Error('Path traversal attempt detected');
    }
    return resolved;
}
```

### 4. Validation Command Security

Validation commands must:
- Validate all input parameters
- Sanitize file paths before filesystem operations
- Return safe error messages (no stack traces in production)
- Use structured error formatting

```typescript
async function verifySpecStructure(slug: string, targetDir?: string) {
    // Validate inputs
    if (!validateSlug(slug)) {
        throw new Error('Invalid slug format');
    }

    const baseDir = targetDir || process.cwd();
    const specDir = safePath(baseDir, `.specs/changes/${slug}`);

    // Safe filesystem operations
    // ...
}
```

---

## Security Considerations

### CLI Execution

The CLI performs these security-sensitive operations:

| Operation | Risk | Mitigation |
|-----------|------|------------|
| File system writes | Data loss | User confirmation, overwrite flags |
| MCP config modification | Credential exposure | Configurable paths, user consent |
| Template injection | Code injection | Template validation, no executable code |

### External MCP Configuration

When configuring external MCP servers (sequential-thinking, memory):

| Operation | Risk | Mitigation |
|-----------|------|------------|
| Read MCP config | Information disclosure | Path validation, user-owned configs only |
| Write MCP config | Config corruption | Atomic writes, backups |

---

## Dependency Security

### Vulnerability Scanning

Regular security audits:

```bash
# Check for known vulnerabilities
pnpm audit

# Update dependencies
pnpm update
```

### Dependency Policy

1. Use minimal dependencies
2. Prefer well-maintained packages
3. Review dependency updates before merging
4. Pin dependency versions in production

---

## Security Best Practices

### For Contributors

1. **Never expose internal errors** to end users
2. **Always validate inputs** at function boundaries
3. **Use TypeScript strict mode** to catch type errors
4. **Run `pnpm audit`** before submitting PRs
5. **Review file operations** for path traversal risks

### For Users

1. **Review injected files** before committing to repositories
2. **Understand MCP permissions** for external MCP servers you configure
3. **Keep the package updated** for security fixes
4. **Report suspicious behavior** promptly

---

## Security Contacts

| Role | Contact |
|------|---------|
| Maintainer | [Lindoélio Lázaro](mailto:lindoelio@gmail.com) |
| Security Issues | [lindoelio@gmail.com](mailto:lindoelio@gmail.com) |

---

## Security Changelog

| Date | Issue | Resolution |
|------|-------|------------|
| Initial | Security policy established | N/A |

---

## See Also

- [AGENTS.md](AGENTS.md) - Build and test commands
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [TESTING.md](TESTING.md) - Testing patterns

<!-- SpecDriven:managed:end -->
