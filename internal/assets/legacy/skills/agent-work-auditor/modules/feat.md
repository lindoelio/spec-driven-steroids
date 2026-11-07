# feat — New Feature Review

**Posture:** Thorough

## Primary Focus

- Overall design — do the interactions between pieces make sense?
- Does the feature belong in this codebase or should it be a library?
- Does it integrate well with the rest of the system?
- Is now a good time to add this functionality?
- Scalability — will this design hold as usage grows?

## Secondary Focus

- Naming clarity and consistency
- Test coverage for all functional requirements
- Edge cases and error paths
- Documentation of the new feature

## What Blocks Approval

- Design flaw that will cause problems at scale
- Missing tests for core functionality
- Security or correctness issues
- Violation of project style guide (required rules)
- Incomplete feature implementation

## What Is Nit

- Suggestion to name something more descriptively
- Minor style preferences not in the style guide
- Requests to add functionality that isn't needed now
- Over-engineering for current requirements