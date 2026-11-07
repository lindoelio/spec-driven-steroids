# refactor — Refactoring Review

**Posture:** Rigorous

## Primary Focus

- Behavioral parity — does the refactored code produce identical results to the original?
- No behavior change (output, performance, error handling)
- Readability improvements
- Code deduplication and DRY principles
- Removal of dead code

## Secondary Focus

- Whether the refactoring enables the next logical step
- Test coverage is maintained or improved
- Whether the change is actually an improvement in code health

## What Blocks Approval

- Any behavioral change between original and refactored code
- Reduced test coverage
- Increased complexity without improvement
- Introduction of a safety or correctness issue
- Violation of project style guide (required rules)

## What Is Nit

- Style preferences not in the style guide
- Naming suggestions that don't materially improve clarity
- Requests to restructure code in ways that don't improve readability or reduce duplication