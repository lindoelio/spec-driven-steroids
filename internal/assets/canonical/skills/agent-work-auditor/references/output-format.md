# Output Format

## Markdown Report Template

```markdown
# Audit Report — {change-type}

**Artifact:** {path}
**Timestamp:** {ISO-8601}
**Verdict:** Approve | Request Changes | Approval with Notes

## Summary
{2-3 sentence overall assessment}

## Direct Fixes Applied
| Finding | Fix Applied | Status |
|---------|-------------|--------|
| {title} | {fix description} | fixed |

## Blocking Findings (Author Required)
| Finding | Decision Needed | Status |
|---------|---------------|--------|
| {title} | {question needing answer} | pending |

## Nit Findings
| Finding | Suggestion | Status |
|---------|------------|--------|
| {title} | {suggestion} | fixed | pending |

## Mentoring / Good Things
| Observation |
|-------------|
| {positive finding} |

## Traceability Matrix (spec-driven only)
| REQ | DES | TASK | Coverage |
|-----|-----|------|----------|
| REQ-1 | DES-1 | TASK-1.1 | Covered |
```

---

## JSON Output Schema

```json
{
  "artifact": "{path}",
  "changeType": "{type}",
  "artifactType": "code | specification | design | tasks | mixed",
  "timestamp": "{ISO-8601}",
  "verdict": "Approve | Request Changes | Approval with Notes",
  "dimensions": {
    "completeness": { "score": 1-5, "findings": [] },
    "correctness": { "score": 1-5, "findings": [] },
    "consistency": { "score": 1-5, "findings": [] },
    "traceability": { "score": 1-5, "findings": [] },
    "safety": { "score": 1-5, "findings": [] },
    "maintainability": { "score": 1-5, "findings": [] }
  },
  "findings": [
    {
      "id": "F-1",
      "severity": "blocking | warning | info",
      "fixability": "direct-fix | author-required | informational",
      "dimension": "{dimension}",
      "title": "{finding title}",
      "description": "{detailed description}",
      "location": "{file:line or artifact:section}",
      "fix": "{suggested fix or null}",
      "status": "fixed | pending | escalated"
    }
  ],
  "summary": "{overall assessment}",
  "statistics": {
    "total": {n},
    "blocking": {n},
    "warning": {n},
    "info": {n},
    "fixed": {n},
    "pending": {n},
    "escalated": {n}
  }
}
```

---

## Verdict Definitions

| Verdict | Definition |
|---------|------------|
| **Approve** | All blocking findings resolved. Ready to merge. |
| **Request Changes** | Author-required blocking findings present. Author must address. |
| **Approval with Notes** | Scoped review complete. Other reviewers should address remaining items. |