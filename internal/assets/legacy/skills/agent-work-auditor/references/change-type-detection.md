# Change Type Detection

Detect the change type in priority order.

## Detection Priority

### 1. Explicit Tag (Highest Priority)

User provides a type tag directly in the invocation:

```
type:feat, type:fix, type:hotfix, type:refactor, type:migrate, type:docs, type:general
```

Use the provided type directly.

### 2. Branch Name Scan

Check the branch name for conventional-commit prefixes:

| Branch Prefix | Detected Type |
|--------------|---------------|
| `feat/` | feat |
| `fix/` | fix |
| `hotfix/` | hotfix |
| `refactor/` | refactor |
| `chore/` | migrate |
| `migrate/` | migrate |
| `docs/` | docs |

### 3. Commit Message Scan

Examine the last 5 commit messages for conventional-commit prefixes:

- `feat:` → feat
- `fix:` → fix
- `hotfix:` → hotfix
- `refactor:` → refactor
- `chore:` → migrate
- `docs:` → docs

Use the most frequent prefix among the last 5 messages.

### 4. Heuristic Inference

If no prefix found, infer from prompt language:

| Prompt Keywords | Detected Type |
|----------------|---------------|
| bug fix, fix this, fix for | fix |
| hot patch, production issue, emergency | hotfix |
| restructure, clean up, reorganize | refactor |
| migrate, upgrade, port, convert | migrate |
| update docs, add readme, document | docs |
| new feature, add capability, implement | feat |

### 5. Fallback

If no signal and no confident guess, use `general` type (balanced core-only review).

**Note:** `general` is a distinct type that loads `modules/general.md` which applies core dimensions without a specific posture. This is different from "no module" because it still provides the balanced general-purpose review strategy.

## Multi-Type Detection

Some changes span multiple types (e.g., refactor+fix). Detection should identify all types present and load multiple modules.

```
# Example: refactor+fix
"Refactor the auth module to fix the session bug"
```

Detected types: [refactor, fix]

Both modules are loaded and findings are merged.