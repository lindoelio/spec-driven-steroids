---
name: quality-grading
description: Use this skill to grade code, specifications, or design documents across four quality dimensions using a 1-5 scoring scale. In grade-and-fix mode, the skill auto-improves artifacts scoring below 4 without prompting. Invoke when you want consistent quality assessment on design, implementation, or specification with actionable feedback and self-healing improvements.
---

# Quality Grading Skill

Evaluate and improve code, specifications, or design documents across four quality dimensions with calibrated scoring and auto-fix capabilities.

## Overview

This skill provides a multi-dimensional quality grading system for any artifact type:
- **Code**: Implementation files, modules, functions
- **Specifications**: Requirements documents, README, acceptance criteria
- **Designs**: Architecture documents, system designs, technical specifications

It supports two invocation modes:

- **evaluate**: Score the artifact and return structured JSON results
- **grade-and-fix**: Score the artifact, then auto-fix dimensions scoring below 4, re-grade, and provide final results

The skill targets score 4+ as the quality bar. Auto-fix attempts are limited to 2 per dimension to keep improvements pragmatic and avoid unnecessary complexity.

## Invocation

Load this skill when:
- You want quality feedback on code or implementation
- You want quality feedback on design or architecture documents
- You want quality feedback on specifications or requirements
- You want to improve artifacts scoring below 4 automatically
- You need consistent, calibrated quality assessments

### Input

- `artifact`: Path to the file, directory, or snippet to grade (required)
- `mode`: `evaluate` or `grade-and-fix` (default: `evaluate`)

### Process

1. **Load artifact**: Read the target file, all files in the directory, or parse the snippet
2. **Detect artifact type**: Determine if this is code, a specification, or a design document
3. **Apply dimension rubrics**: Score each of the four dimensions independently, adapting criteria to artifact type
4. **Use calibration examples**: Compare against few-shot examples for consistency
5. **If grade-and-fix mode and score < 4**: Apply targeted auto-fix, re-grade, repeat up to 2 times
6. **Generate JSON output**: Return structured results with scores, justifications, and suggestions

## Grading Dimensions

### 1. Design Quality

**Measures**: Architecture clarity, scalability, and separation of concerns

**For Code**: Module structure, dependency management, separation of concerns
**For Designs**: Architecture clarity, module boundaries, scalability patterns, diagram quality
**For Specifications**: Logical organization, traceability, clarity of structure

**What to look for**:
- Clear module boundaries and logical file organization
- Proven scalability patterns appropriate to the problem
- Strong separation of concerns (no intermingled responsibilities)
- Clean dependency flow

**Scoring Rubric**:

| Score | Descriptor |
|-------|------------|
| 5 | Exceptional architecture with clear module boundaries, proven scalability patterns, strong separation of concerns |
| 4 | Good architecture with clear modules, adequate scalability consideration, minor separation issues |
| 3 | Adequate architecture with recognizable modules, moderate separation of concerns |
| 2 | Weak architecture with unclear module boundaries, limited separation of concerns |
| 1 | Poor architecture with tangled dependencies, no clear modules, intermingled concerns |

**Auto-Fix (score < 4)**:
- Add missing module boundaries or clear separation between concerns
- Consolidate tangled dependencies into logical modules
- Simplify overly complex architectural patterns

### 2. Originality

**Measures**: Avoidance of generic boilerplate and tailoring to the problem

**For Code**: Problem-specific solutions vs copy-paste patterns
**For Designs**: Domain-specific architecture vs generic templates
**For Specifications**: Tailored requirements vs boilerplate language

**What to look for**:
- Problem-specific terminology and approach
- Contextual examples that map to the domain
- Removal of irrelevant template content
- Novel solutions rather than copy-paste patterns

**Scoring Rubric**:

| Score | Descriptor |
|-------|------------|
| 5 | Highly tailored solution with novel approaches directly mapped to the problem domain |
| 4 | Mostly tailored solution with some unique adaptations to the problem |
| 3 | Mix of generic and tailored approaches |
| 2 | Mostly generic with minimal adaptation to the problem |
| 1 | Generic, copy-paste solution with no adaptation to the specific problem |

**Auto-Fix (score < 4)**:
- Replace generic boilerplate with problem-specific terminology
- Add context-specific examples or patterns
- Remove irrelevant template content

### 3. Craft

**Measures**: Code cleanliness, error handling, and documentation

**For Code**: Clean code, error handling, comments, documentation
**For Designs**: Diagram clarity, consistent formatting, completeness
**For Specifications**: Clear writing, consistent terminology, proper structure

**What to look for**:
- Clean, consistent formatting and naming
- Comprehensive error handling for edge cases
- Clear documentation (doc comments, README, inline explanations)
- No obvious bugs or security issues

**Scoring Rubric**:

| Score | Descriptor |
|-------|------------|
| 5 | Exceptionally clean code with comprehensive error handling and exemplary documentation |
| 4 | Clean code with good error handling and documentation with minor gaps |
| 3 | Adequate code quality with some error handling and documentation |
| 2 | Messy code with limited error handling and minimal documentation |
| 1 | Messy, error-prone code with little to no documentation |

**Auto-Fix (score < 4)**:
- Add missing error handling for edge cases
- Clean up inconsistent formatting or naming
- Add doc comments to undocumented functions

### 4. Functionality

**Measures**: Feature completeness and edge case handling

**For Code**: Features work, edge cases handled
**For Designs**: All requirements covered, feasibility, completeness
**For Specifications**: Complete requirements, clear acceptance criteria, no gaps

**What to look for**:
- All specified features are implemented
- Edge cases are identified and handled
- Requirements or acceptance criteria are covered
- No broken references or incomplete specifications

**Scoring Rubric**:

| Score | Descriptor |
|-------|------------|
| 5 | Complete feature implementation with comprehensive edge case handling |
| 4 | Full implementation with minor edge case gaps |
| 3 | Most features implemented with some edge cases handled |
| 2 | Partial implementation with several unhandled edge cases |
| 1 | Missing features and unhandled edge cases causing frequent failures |

**Auto-Fix (score < 4)**:
- Add missing functionality or requirements coverage
- Address identified edge cases in the implementation
- Fix broken references or incomplete specifications

## Self-Healing Behavior

When invoked in `grade-and-fix` mode:

1. **Trigger**: Auto-fix activates for any dimension scoring below 4
2. **Fix Strategy**: Apply minimal, targeted changes that address the specific gap without introducing unnecessary complexity
3. **Re-grade**: After each fix, re-score to verify improvement
4. **Attempts**: Maximum 2 auto-fix attempts per dimension
5. **Fallback**: If auto-fix fails to achieve score 4+, record actionable suggestions instead of blocking
6. **Principle**: Prioritize pragmatic simplicity over exhaustive perfection

## Few-Shot Calibration

Use the examples in `references/` directories to calibrate your scoring:

- **design-quality/**: Examples of architecture quality at each score level
- **originality/**: Examples of boilerplate vs tailored solutions
- **craft/**: Examples of code cleanliness and documentation quality
- **functionality/**: Examples of feature completeness

Compare the artifact you're grading against these examples for consistent calibration.

## Output Format

The skill produces JSON output:

```json
{
  "artifact": "<path-to-graded-file>",
  "artifactType": "code | specification | design",
  "timestamp": "<ISO-8601 timestamp>",
  "mode": "evaluate | grade-and-fix",
  "dimensions": {
    "designQuality": {
      "score": 1-5,
      "justification": "<brief explanation of the score>",
      "improved": "<null | description of auto-fix applied>"
    },
    "originality": {
      "score": 1-5,
      "justification": "<brief explanation of the score>",
      "improved": "<null | description of auto-fix applied>"
    },
    "craft": {
      "score": 1-5,
      "justification": "<brief explanation of the score>",
      "improved": "<null | description of auto-fix applied>"
    },
    "functionality": {
      "score": 1-5,
      "justification": "<brief explanation of the score>",
      "improved": "<null | description of auto-fix applied>"
    }
  },
  "overallScore": "<average of dimensions, displayed as X.Y>",
  "summary": "<overall assessment text>",
  "suggestions": {
    "<dimension>": "<actionable improvement if score < 4 and auto-fix failed>"
  }
}
```

## Glossary

| Term | Definition |
|------|------------|
| Quality Grading Skill | A skill that evaluates artifacts across multiple dimensions using a 1-5 scoring scale |
| Dimension | A distinct aspect of quality being evaluated (Design Quality, Originality, Craft, Functionality) |
| Artifact Type | The category of artifact being graded: code, specification, or design |
| Few-Shot Calibration | Providing example artifacts with known scores to guide consistent grading |
| Self-Healing | The skill's ability to auto-fix quality gaps without user prompting |
| Grade-and-Fix Mode | Invocation mode where grading and improvement are performed sequentially without user input |

## Examples

### Example: Evaluate Code Quality

```
User: Grade this implementation using quality-grading skill
Artifact: src/services/auth.ts
Mode: evaluate
```

### Example: Grade Design Document

```
User: Assess the quality of this architecture design
Artifact: docs/architecture/system-design.md
Mode: grade-and-fix
```

### Example: Evaluate Specification

```
User: Grade this requirements document
Artifact: specs/changes/feature/requirements.md
Mode: evaluate
```

### Example: Grade and Fix

```
User: Grade and improve this module
Artifact: src/utils/
Mode: grade-and-fix
```
