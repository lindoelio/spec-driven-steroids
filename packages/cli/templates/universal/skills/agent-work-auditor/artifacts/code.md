# Artifact-Type Guidance: Code

Guidance for auditing code artifacts (implementation files, modules, functions).

## What to Evaluate

### Completeness

- All required functions/classes present
- All exports are defined
- All dependencies are declared
- No truncated code (missing closing braces, etc.)

### Correctness

- Logic is syntactically correct
- Type signatures are consistent
- Error handling is present
- No obvious runtime errors

### Consistency

- Naming follows project conventions
- Style matches surrounding code
- Import patterns are consistent
- Module structure is standard

### Traceability

- Code traces to design element
- Implementation matches specification
- Tests cover the code

### Safety

- No credentials in code
- No injection vulnerabilities
- Input validation present
- No memory leaks

### Maintainability

- Code is readable
- Functions are focused
- Comments explain why, not what
- No redundant code