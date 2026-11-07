# Maintainability Dimension

Measures whether code is readable, testable, and documented for future developers.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Exceptionally maintainable, exemplary documentation |
| 4 | Good maintainability, minor documentation gaps |
| 3 | Adequate maintainability, several gaps |
| 2 | Poor maintainability, significant effort needed |
| 1 | Unmaintainable without significant rewrite |

## Checklist

### Readability

- [ ] Code is self-documenting
- [ ] Complex logic is explained
- [ ] Names are descriptive
- [ ] Structure is logical

### Documentation

- [ ] Purpose is clearly documented
- [ ] Usage examples exist
- [ ] Known limitations are documented
- [ ] Dependencies are documented

### Testability

- [ ] Code is testable (no tight coupling)
- [ ] Test points are accessible
- [ ] Mocking is possible
- [ ] Edge cases are identifiable

### Future-Proofing

- [ ] No hardcoded values
- [ ] Configuration is externalized
- [ ] Extension points exist
- [ ] Technical debt is minimal

## Auto-Fix Prompts

### Missing Documentation

If documentation is lacking:
1. Identify what documentation is missing
2. Add minimal viable documentation
3. Flag for author review if substantial

### Unclear Code

If code is unclear:
1. Identify the unclear section
2. Add explanatory comments
3. If rename would help, flag for author

## Questions to Ask

- "Can a new developer understand this?"
- "Is the purpose obvious?"
- "How hard would it be to modify?"
- "What would a future developer need to know?"
- "Is there unnecessary complexity?"