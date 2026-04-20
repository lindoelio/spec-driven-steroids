# Consistency Dimension

Measures whether naming matches codebase conventions and patterns are uniform.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Perfect consistency with codebase conventions |
| 4 | Minor inconsistencies, core consistency maintained |
| 3 | Several inconsistencies in naming or formatting |
| 2 | Significant deviations from conventions |
| 1 | No attempt to match codebase conventions |

## Checklist

### Naming Conventions

- [ ] File names follow project conventions
- [ ] Identifier names match project style
- [ ] Terms are used consistently throughout
- [ ] Abbreviations are consistent with project usage

### Formatting Consistency

- [ ] Heading levels follow a logical hierarchy
- [ ] List styles are consistent
- [ ] Code block formatting is uniform
- [ ] Table formats are consistent

### Pattern Consistency

- [ ] Similar constructs use similar patterns
- [ ] Template structures are followed
- [ ] Section organization matches conventions
- [ ] Import/module patterns are consistent

## Auto-Fix Prompts

### Naming Inconsistencies

If naming doesn't match conventions:
1. Identify the convention from project guidelines
2. If clear, rename to match convention
3. If ambiguous, mark as author-required

### Formatting Issues

If formatting is inconsistent:
1. Identify the project's formatting standard
2. Apply consistent formatting
3. Document the standard if not already documented

## Questions to Ask

- "Does the naming match project conventions?"
- "Is terminology used consistently?"
- "Do similar constructs look similar?"
- "What does the codebase use as the standard?"