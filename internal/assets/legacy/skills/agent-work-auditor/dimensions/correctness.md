# Correctness Dimension

Measures whether logic is valid, references resolve, and no errors exist.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Logic is sound, all references resolve, no errors |
| 4 | Minor logic issues, all references resolve |
| 3 | Several logic gaps, most references resolve |
| 2 | Significant logic errors, some broken references |
| 1 | Fundamentally flawed logic, broken references |

## Checklist

### Logic Validation

- [ ] Statements are internally consistent
- [ ] No contradictions within the content
- [ ] Assumptions are stated and reasonable
- [ ] Conclusions follow from premises

### Reference Integrity

- [ ] All internal links resolve
- [ ] All external links are valid
- [ ] IDs (REQ-*, DES-*) are properly formatted
- [ ] ID references point to existing items

### Technical Accuracy

- [ ] Technical claims are accurate
- [ ] Code examples are syntactically correct
- [ ] Configuration values are valid
- [ ] Version numbers match reality

## Auto-Fix Prompts

### Broken References

If a reference doesn't resolve:
1. Identify the reference target
2. If target exists but reference is wrong, fix the reference
3. If target is missing, either create it or remove the reference
4. Mark as author-required if ambiguous

### Logic Errors

If logic appears flawed:
1. Identify the specific claim
2. Verify against source of truth
3. If error found, correct it
4. If claim is contested, mark as author-required

## Questions to Ask

- "Do the conclusions follow from the premises?"
- "Are there any internal contradictions?"
- "Do all references point to real targets?"
- "What assumptions are being made?"