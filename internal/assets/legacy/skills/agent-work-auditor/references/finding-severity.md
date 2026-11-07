# Finding Severity Classification

## Severity Axis

### Blocking

**Must fix before approval.**

Criteria:
- Code health degrades (maintainability, readability, testability worsens)
- Safety violation (security vulnerability, memory leak, unhandled error)
- Style guide violation (required style point not followed)
- Correctness bug (logic error, off-by-one, wrong assumption, missing edge case)
- Missing or broken tests (test doesn't cover the scenario it claims)

### Warning

**Should fix but not a gate.**

Criteria:
- Style preference not in the style guide
- Minor readability improvement
- Over-engineering suggestions for future needs
- Naming that is "good enough" but could be more descriptive

### Info

**FYI only.**

Criteria:
- Mentoring (teaches a language feature, framework pattern, or design principle)
- Good things observed
- Sharing knowledge that improves code health over time

---

## Fixability Axis

### direct-fix

**Auto-fixable, agent applies immediately.**

The fix is unambiguous and can be applied without judgment:
- Missing documentation can be added
- Formatting can be normalized
- Simple logic errors can be corrected
- Missing imports can be added

### author-required

**Requires author judgment or is ambiguous.**

The fix requires human decision:
- Architectural choices
- Trade-offs between competing concerns
- Security decisions
- API contract changes

### informational

**Mentoring or good-notice finding.**

No action required:
- Educational comments
- Sharing of good practices
- Notes about positive observations

---

## Prefixes

| Prefix | Use For | Blocks Approval? |
|--------|---------|-----------------|
| (none) | Blocking findings | Yes |
| Nit: | Non-blocking polish suggestions | No |
| Mentoring: | Educational comments | No |
| LGTM [with notes]: | Scoped sign-off | No |

---

## Finding Format

```markdown
### {finding title}
**Severity:** blocking | warning | info
**Fixability:** direct-fix | author-required | informational

{finding description}

{fix suggestion if applicable}
```

---

## Decision Tree

```
Is this a must-fix issue?
├─ Yes → Is the fix unambiguous?
│   ├─ Yes → direct-fix
│   └─ No → author-required
└─ No → Is this educational?
    ├─ Yes → informational
    └─ No → Is this blocking polish?
        ├─ Yes → warning (with Nit: prefix)
        └─ No → info
```