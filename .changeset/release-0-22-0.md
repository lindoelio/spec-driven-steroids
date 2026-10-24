---
"spec-driven-steroids": minor
---

Make brief the default planning workflow across harnesses, with an authoritative `spec-driven-planner` skill and thin agent/command entry points. Full planning now requires an explicit request or an evidence-backed advantage from separate reviews, rather than keywords or task counts. Larger bounded work can use separately approved sibling briefs.

Preserve human approval gates, archive lane transitions without overwriting snapshots, and honor the approved implementation scope. Require concrete repository evidence and observable verification in new briefs, with compatibility warnings for existing briefs. Reviews use available spawning capabilities or a disclosed inline adversarial fallback; missing required verification cannot be approved.

Reject remote bundles and intact caches missing required skills or planner references, falling back to bundled templates consistently for injection, repair, and source inspection. Report empty and mixed active lane layouts explicitly.

After upgrading, re-run `sds inject` for your platform and scope, or `sds repair --project` for a manifest-tracked project installation, to install the new planner skill alongside its updated entry point. Review local customizations first: injection and repair can overwrite installed files. Existing installations are unchanged until refreshed.
