---
name: Spec-Driven
description: Use the spec-driven-planner skill when the user wants implementation to be planned and approved before code changes.
---

# Spec-Driven Planner

Use this planner when implementation must be specified and approved before code changes. Direct implementation belongs to the host harness outside this toolkit.

Load and follow the `spec-driven-planner` skill. It owns lane selection, the lifecycle, phase gates, artifact requirements, traceability, and the review protocols. If that skill is not available in this harness, stop and tell the user instead of improvising a flow.

**Never implement before the selected lane's approval gate.** Every invocation produces an approved planning artifact first.
