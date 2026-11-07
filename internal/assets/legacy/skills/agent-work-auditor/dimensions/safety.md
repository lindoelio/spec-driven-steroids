# Safety Dimension

Measures whether the change could cause harm: security issues, data loss, or breaking changes.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | No safety concerns, no breaking changes, secure |
| 4 | Minor concerns that don't block, minimal risk |
| 3 | Several safety considerations that should be addressed |
| 2 | Significant safety concerns that should block |
| 1 | Critical safety issues present |

## Checklist

### Security

- [ ] No credentials or secrets exposed
- [ ] No injection vulnerabilities introduced
- [ ] Authentication/authorization handled correctly
- [ ] Input validation is present and correct
- [ ] Sensitive data is protected

### Data Integrity

- [ ] No data loss possible
- [ ] Migration paths preserve data
- [ ] Rollback plans exist for dangerous changes
- [ ] Backup strategies are considered

### Breaking Changes

- [ ] No breaking changes to public APIs
- [ ] No breaking changes to data schemas
- [ ] No breaking changes to expected behavior
- [ ] Deprecation paths exist for removed features

### Error Handling

- [ ] Errors are handled gracefully
- [ ] Error messages don't leak sensitive info
- [ ] Failures are logged appropriately
- [ ] Recovery paths exist

## Auto-Fix Prompts

### Credentials/Secrets Exposure

If credentials are exposed:
1. Remove the credentials immediately
2. Use environment variables or secrets management
3. Mark as blocking, author-required

### Breaking Changes

If breaking changes are present:
1. Document the breaking change
2. Provide migration path
3. Mark as blocking, author-required

## Questions to Ask

- "Could this change expose sensitive data?"
- "What happens if this fails?"
- "Is there a rollback path?"
- "Who is affected by this change?"
- "What could go wrong?"