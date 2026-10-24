---
"spec-driven-steroids": minor
---

Add MiniMax Code as a supported platform. It receives skills only: project scope writes to `.minimax/skills`, the workspace directory its runtime reads with the highest priority, and global scope writes to `~/.agents/skills`, the shared Agent Skills directory its runtime reads as an external user source.

```bash
sds inject --platform minimax-code --scope project --yes
```

The `spec-driven` entry skill and every universal skill are installed, so `/skill:spec-driven` starts the brief-first flow. `sds clean` removes only the SDS-owned skill directories from the shared location and leaves other skills there untouched.

After upgrading, re-run `sds inject --platform minimax-code` for the intended scope, or `sds repair --project` for a manifest-tracked project install. Review local customizations first: injection and repair can overwrite installed files.
