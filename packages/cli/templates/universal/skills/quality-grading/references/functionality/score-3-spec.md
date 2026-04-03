# Functionality Calibration Example

## Score: 3 (Partial Specification)

### Excerpt

```markdown
## Requirements

### User Registration
- Email and password registration
- Email verification link

### User Login
- Email and password login
- JWT token generation

## Missing
- Password reset flow
- Account deletion
- Session management
- OAuth/social login
```

### Justification

- Core features present: registration, login, JWT
- Some edge cases handled: email verification, password requirements
- Missing significant features:
  - Password reset (critical gap)
  - Account deletion (GDPR compliance)
  - Session management
  - OAuth/social login options
- No error scenarios or acceptance criteria detailed

### Score: 3
