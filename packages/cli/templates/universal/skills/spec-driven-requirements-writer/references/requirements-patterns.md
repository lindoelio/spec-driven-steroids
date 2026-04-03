# Requirements Patterns

Use this reference when a requirement draft feels vague, slips into design detail, or needs stronger EARS phrasing.

## Strong Requirement Moves

- Prefer one observable behavior per acceptance criterion.
- Name the system subject explicitly.
- Use concrete verbs such as `display`, `reject`, `create`, `record`, or `notify`.
- Move implementation choices into assumptions only when they materially affect scope.

## Example Rewrites

- Weak: `The system should support remote templates.`
- Better: `WHEN the inject command starts, THEN the toolkit SHALL attempt to retrieve the latest published remote templates.`

- Weak: `The system should handle malformed bundles gracefully.`
- Better: `IF the toolkit cannot retrieve valid remote templates during inject, THEN the toolkit SHALL continue injection by using locally available templates.`

## Recovery Pattern

If a criterion fails validation:

1. Replace weak verbs with observable behavior.
2. Reorder the clauses into canonical EARS form.
3. Ensure exactly one `SHALL` remains.
4. Re-check numbering and system subject naming.
