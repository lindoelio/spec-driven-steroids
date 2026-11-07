# Traceability Dimension

Measures whether changes can be traced to their source and requirements to implementation.

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | Complete traceability chain, every element traced to source |
| 4 | Minor gaps, core traceability maintained |
| 3 | Several gaps in traceability chain |
| 2 | Significant traceability gaps |
| 1 | No meaningful traceability |

## Checklist

### Source Traceability

- [ ] Every requirement traces to a source (user story, bug, tech debt)
- [ ] Every design element traces to a requirement
- [ ] Every implementation traces to a design element
- [ ] Changes trace to a documented reason

### Requirement Coverage

- [ ] Every requirement has acceptance criteria
- [ ] Every acceptance criterion is testable
- [ ] Tests trace to acceptance criteria
- [ ] No orphaned requirements

### Dependency Mapping

- [ ] Dependencies are documented
- [ ] Dependency changes are tracked
- [ ] Breaking changes are identified

## Auto-Fix Prompts

### Missing Trace Links

If trace links are missing:
1. Identify the untraced element
2. Find the appropriate source to link
3. If no source exists, document the rationale
4. Mark as author-required if ambiguous

### Broken Trace Chains

If a trace chain is broken:
1. Identify the break point
2. Determine if the target exists
3. If target missing, either create or document why it's absent

## Questions to Ask

- "Where did this requirement come from?"
- "What requirement does this design element satisfy?"
- "What design does this implementation follow?"
- "Can we trace every change back to a documented reason?"