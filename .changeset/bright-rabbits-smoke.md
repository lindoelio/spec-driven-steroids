---
"spec-driven-steroids": minor
---

Release `0.6.0` with a broad prompt and template quality upgrade across the Spec-Driven workflow.

Highlights:

- rewrite the universal Spec-Driven skills for requirements, technical design, task decomposition, task implementation, and project guideline generation to improve clarity, validator alignment, and LLM efficiency
- normalize the `spec-driven` and `inject-guidelines` user experience across GitHub, OpenCode, Antigravity, and Codex wrappers so phase gating, approvals, traceability, and guideline generation behave much more consistently
- align Codex support with current Codex conventions by using a native TOML custom agent, removing redundant Codex-local `AGENTS.md`, and simplifying Codex command prompts
- tighten EARS and Mermaid guidance to reduce malformed artifacts and make generated `requirements.md` and `design.md` files more reliable with the built-in validators
- update template and integration tests to reflect the normalized cross-platform behavior and strengthened prompt contracts

This release is focused on better publishing quality, stronger platform parity, and more reliable downstream generation from the bundled templates.
