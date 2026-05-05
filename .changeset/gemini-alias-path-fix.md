---
"spec-driven-steroids": patch
---

fix: Prevent skill copy and clean operations on ~/.agents/skills/ alias path

The CLI was incorrectly copying skills to ~/.agents/skills/ during Gemini CLI user-level injection and incorrectly attempting to clean skills from that path. This path is an alias/discovery path and must never be modified by the CLI.

- Removed buggy code that copied skills to ~/.agents/skills/ during Gemini CLI USER injection
- Removed buggy code that attempted to remove skills from ~/.agents/skills/ during clean
- Added integration tests to verify the fix
