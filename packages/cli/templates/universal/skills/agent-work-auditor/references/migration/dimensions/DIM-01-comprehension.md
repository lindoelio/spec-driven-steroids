# DIM-1: Codebase Comprehension

**Question:** Did the agent actually read and understand the legacy codebase?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Agent read every file, can trace any behavior to specific code locations |
| 4 | Agent read >80% of relevant files, minor gaps in peripheral modules |
| 3 | Agent read majority of core files but missed several peripheral ones |
| 2 | Agent read only obvious files, assumed rest without verification |
| 1 | Agent summarized without reading, made unsupported assumptions |

## Audit Questions

1. List every file you read in the legacy codebase
2. For files you did NOT read, explain why they are irrelevant to migration
3. For each major behavior claimed, cite the specific code location
4. What tools did you use to explore the codebase? (glob, grep, read patterns)

## Evidence Requirements

- Code inventory document with file listing
- Annotation of which files were read vs assumed
- Specific code citations for behavioral claims

## Auto-Fix

Not applicable — this dimension requires human verification of reading habits.

## Probing Questions

- "Show me where in the legacy code the auth token is generated"
- "What file contains the session expiry logic?"
- "How did you discover the logging side effect in module X?"