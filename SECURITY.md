# SECURITY.md

> Security policy, vulnerability reporting, and security practices for Spec-Driven Steroids.

<!-- SpecDriven:managed:start -->

## Reporting Security Issues

### How to Report

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email: `lindoelio [at] gmail.com`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### Response Timeline

| Timeline | Action |
|----------|--------|
| 24-48 hours | Acknowledge report |
| 7 days | Initial fix proposal |
| 30 days | Public disclosure |

## Security Practices

### Input Validation

All user inputs must be validated:

```typescript
interface ValidationSchema {
  type: 'string' | 'number' | 'enum';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: string[];
}

function validateInput(input: unknown, schema: ValidationSchema): ValidationResult {
  if (schema.required && !input) {
    return { valid: false, error: 'Input required' };
  }
  // Additional validation logic
}
```

### File System Operations

- Validate all file paths to prevent directory traversal
- Use path.resolve() to normalize paths
- Restrict operations to specified directories

```typescript
const ALLOWED_DIRECTORIES = [
  process.cwd(),
  os.homedir()
];

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_DIRECTORIES.some(dir => resolved.startsWith(dir));
}
```

### Command Injection Prevention

Never pass unsanitized input to shell commands:

```typescript
import { escapeShellArg } from 'shell-escape';

// Use execFile instead of exec
import { execFile } from 'child_process';

// Correct
execFile('spec-driven', ['validate', 'structure'], { cwd: projectDir });

// Avoid
exec(`spec-driven validate ${userInput}`);
```

### Sensitive Data Handling

- Never log sensitive data (API keys, tokens, credentials)
- Clear sensitive data from memory after use
- Use environment variables for secrets

```typescript
// Do NOT log sensitive data
console.log('Processing file:', filePath); // Safe
console.log('API key:', apiKey); // Unsafe - do NOT do this
```

## Dependency Security

### Update Dependencies

Regularly update dependencies to address known vulnerabilities:

```bash
pnpm audit
pnpm audit fix
```

### Dependency Scanning

GitHub Dependabot is enabled for this repository. It will:
- Alert on known vulnerabilities
- Create PRs with security updates
- Monitor transitive dependencies

## Access Control

### Scope Restrictions

The CLI operates within user-specified scopes:

| Scope | Access |
|-------|--------|
| `project` | Current directory and subdirectories |
| `global` | Platform config directories only |

Platform scopes ensure:
- No unauthorized file access
- Configurable permission boundaries
- User consent for all operations

## Platform-Specific Security

### Global Injection

Global injection writes to platform directories:
- `~/.config/` (Linux/macOS)
- Platform-specific config locations

Only inject with explicit user consent.

### MCP Servers

MCP servers run in user context. Ensure:
- No network access beyond necessary
- Minimal required permissions
- Proper exit codes on failure

## Security Checklist

Before releasing:

- [ ] Run `pnpm audit` - no high/critical vulnerabilities
- [ ] Review file system operations - no directory traversal risks
- [ ] Validate all user inputs - no injection vulnerabilities
- [ ] Check sensitive data handling - no credentials logged
- [ ] Test scope restrictions - no unauthorized access
- [ ] Update dependencies - no known CVEs

## Security Tooling

| Tool | Purpose |
|------|---------|
| `pnpm audit` | Dependency vulnerability scanning |
| Dependabot | Automated security updates |
| ESLint | Code quality and security patterns |

<!-- SpecDriven:managed:end -->

## See Also

- [AGENTS.md](AGENTS.md) - Project structure
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development workflow
- [TESTING.md](TESTING.md) - Testing patterns