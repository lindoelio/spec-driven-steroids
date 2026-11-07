# Completeness Dimension

Measures whether all required parts exist and no content is truncated.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | All required parts exist, no truncated content, every section complete |
| 4 | Minor gaps in peripheral sections, core content complete |
| 3 | Several sections incomplete or truncated |
| 2 | Major sections missing, significant content gaps |
| 1 | Core content missing or fundamentally incomplete |

## Checklist

### Required Sections

- [ ] All required sections present
- [ ] No truncated content (look for "..." or incomplete sentences)
- [ ] No placeholder content (TBD, TODO without description)
- [ ] All referenced files/externals exist

### Content Integrity

- [ ] No empty sections without justification
- [ ] No orphaned references (links to non-existent sections)
- [ ] All tables have headers
- [ ] All lists have items

### Scope Verification

- [ ] Scope is clearly defined
- [ ] In-scope items are included
- [ ] Out-of-scope items are not present

## Auto-Fix Prompts

### Truncated Content

If content appears truncated:
1. Identify the incomplete section
2. Complete the thought or sentence
3. Verify the completion makes sense in context

### Missing References

If a reference target is missing:
1. Create the missing section or file
2. If the reference is unnecessary, remove the reference
3. If uncertain, mark as author-required

### Empty Sections

If a section is empty:
1. If the section is required, add appropriate content
2. If the section is optional, remove it
3. If unsure, mark as author-required

## Questions to Ask

- "Is every required section present?"
- "Does any content appear to be cut off mid-sentence?"
- "Are all external references valid?"
- "What would break if this were the complete artifact?"