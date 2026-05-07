# Artifact-Type Guidance: Requirements

Guidance for auditing requirements documents (specifications, acceptance criteria).

## What to Evaluate

### Completeness

- All requirements have acceptance criteria
- Acceptance criteria are testable
- Scope is clearly defined
- No placeholder requirements

### Correctness

- EARS syntax is valid
- System subject is named
- Exactly one SHALL per criterion
- No conflicting requirements

### Consistency

- Terminology is consistent
- Requirement IDs are sequential
- AC numbering matches REQ numbering
- Glossary is present if needed

### Traceability

- Requirements trace to user needs
- Acceptance criteria trace to requirements
- No orphaned requirements

### Safety

- Security requirements are present
- Error handling is specified
- Data integrity is addressed

### Maintainability

- Requirements are unambiguous
- Scope is clear
- Assumptions are documented

## Red Team Questions (Confidence Gate)

When auditing requirements, adopt a rejector persona and answer these adversarial questions. You must find at least 3 plausible weaknesses before declaring confidence.

1. **Did I miss edge cases that make these untestable?** Would a developer know exactly what NOT to build? What hidden assumptions are unstated?
2. **Are the acceptance criteria truly testable?** Could an independent tester verify each criterion without asking clarifying questions? Is every criterion a single, observable behavior?
3. **Is scope creep already hiding in the requirements?** Are there vague verbs (`support`, `handle`, `manage`) that could expand the scope indefinitely?
4. **Would a malicious reader misinterpret any requirement?** Are there ambiguous terms that lack glossary definitions? Are boundary conditions (null, empty, max values) specified?
5. **Do the requirements collectively solve the user's stated problem?** Is there a requirement that does not trace to the original user need? Is there a user need with no requirement covering it?
6. **Are error handling and recovery requirements complete?** What happens when every upstream dependency fails? Are failure modes specified with EARS syntax?