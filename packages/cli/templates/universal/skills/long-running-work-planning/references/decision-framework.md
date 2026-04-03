# Decision Framework

Detailed guidance for deciding when and how to use long-running continuity strategies.

## Complexity Assessment Checklist

Before invoking any continuity strategy, answer these questions:

1. **Is the solution path obvious?** If you can immediately see the steps, skip the tool.
2. **Are there multiple valid approaches?** Yes → consider using structured reasoning.
3. **Could my initial assumption be wrong?** Yes → structured reasoning helps catch errors.
4. **Will this require backtracking or revision?** Yes → maintain traceability with MCP.
5. **Is the problem scope unclear?** Yes → use structured reasoning to break it down.
6. **Will this take more than 10 steps?** Yes → chunk the work proactively.

If 2+ answers suggest complexity, use a continuity strategy.

## Timeout Risk Indicators

### Threshold Detection

| Risk Factor | Low | Medium | High |
|-------------|-----|--------|------|
| **Estimated steps** | 1-5 | 6-10 | 10+ |
| **Files affected** | 1-2 | 3-5 | 5+ |
| **Domain familiarity** | Known | Somewhat known | New |
| **Requirements clarity** | Clear | Partially clear | Ambiguous |
| **Dependencies** | None | Internal | External |

**Risk Level Calculation:**
- Count factors in each column
- If High ≥ 2: Chunk immediately, use MCP + to-do
- If Medium ≥ 3: Consider chunking, use MCP or to-do
- If all Low: Direct approach may suffice

### Warning Signs During Execution

Watch for these signs that you're approaching timeout limits:

- **Step count exceeds estimate**: Recalculate and chunk
- **Thoughts are repeating**: Conclude or pivot
- **Progress has stalled**: No new insights in 2-3 steps → conclude or chunk
- **Context growing rapidly**: Summarize and restart sequence
- **New information discovered**: May need to revise earlier conclusions

## Continuity Strategies

### Strategy Decision Matrix

| Available Tools | Recommended Strategy | Benefits |
|-----------------|---------------------|----------|
| MCP + To-Do | Combined approach | Structured reasoning + visible progress |
| MCP only | Sequential-thinking MCP | Structured reasoning with revision/branching |
| To-Do only | Task decomposition | Visible progress, clear steps |
| Neither | Manual chunking | Works in any environment |

### Strategy 1: Combined MCP + To-Do (Recommended)

**When to use:** Both tools available, complex multi-step task

**Pattern:**
```
1. Create to-do list with high-level phases
2. Use MCP for reasoning within each phase
3. Update to-do as phases complete
4. Output intermediate results between phases
```

**Example workflow:**
```
[To-Do Created]
- [ ] 1. Analyze requirements
- [ ] 2. Design architecture
- [ ] 3. Create implementation plan

[MCP Reasoning Phase 1]
thought 1: "Requirements analysis..."
thought 2: "Key constraints identified..."
thought 3: "Requirements understood"

[To-Do Updated]
- [x] 1. Analyze requirements
- [~] 2. Design architecture
...

[MCP Reasoning Phase 2]
thought 4: "Architecture options..."
...
```

### Strategy 2: Sequential-Thinking MCP

**When to use:** MCP available, complex reasoning needed

**Thought count estimation:**

| Problem Type | Recommended `totalThoughts` |
|--------------|----------------------------|
| Simple debugging | 3-4 |
| Feature design | 4-6 |
| Architecture decision | 5-8 |
| Complex debugging | 6-10 |
| Open-ended analysis | Start at 5, extend as needed |

**Rules of thumb:**
- Start lower, extend with `needsMoreThoughts: true`
- If you exceed initial estimate, set `totalThoughts` to match `thoughtNumber`
- Never go below 3 thoughts — if that's enough, you probably don't need the tool

### Strategy 3: To-Do Tools

**When to use:** No MCP, but to-do tools available

**Best practices:**
- Create to-do list before starting work
- Mark in-progress immediately when starting a task
- Mark complete only after verification
- Keep tasks atomic (one focused concern each)
- Group related tasks under phases

**Task sizing:**
- Each task should be completable in one focused session
- If a task has "and" in the title, consider splitting
- Maximum 7 tasks per phase for cognitive load

### Strategy 4: Manual Chunking

**When to use:** No specialized tools available

**Chunking patterns:**

#### Pattern A: Phase-Based Chunking
```
## Phase 1: Analysis
<work and output>

## Phase 2: Design
<work and output>

## Phase 3: Implementation
<work and output>
```

#### Pattern B: Step-Based Chunking
```
[Step 1/5] <description>
<output>

[Step 2/5] <description>
<output>
...
```

#### Pattern C: Checkpoint-Based Chunking
```
Checkpoint: <milestone>
<output>

Checkpoint: <milestone>
<output>
...
```

## Incremental Output Patterns

### When to Output

**Output early and often:**
- After completing each logical unit of work
- When discovering important information
- Before moving to a new phase
- When revising previous conclusions

**Avoid holding output:**
- Don't wait until everything is complete
- Don't accumulate findings silently
- Don't defer progress updates

### Output Format Examples

#### Progress Marker Format
```
[Progress 1/3] Analyzing the codebase...
Found 5 related modules: auth, users, sessions, tokens, permissions

[Progress 2/3] Identifying the root cause...
The issue appears to be in token validation logic

[Progress 3/3] Proposing fix...
Update validateToken() to handle edge case...
```

#### Summary Format
```
## Analysis Complete
- Root cause: Token expiration not handling timezone correctly
- Affected files: 3
- Risk level: Medium

## Proposed Solution
1. Update token validation logic
2. Add timezone handling
3. Add unit tests
```

#### Checkpoint Format
```
✓ Requirements gathered
✓ Design approach selected
→ Implementing solution...

[Implementation output]
```

## Branching Strategy

Use branching when:

- You hit a dead end and want to explore an alternative
- Multiple approaches seem equally valid
- You want to compare tradeoffs systematically

**Branch naming:** Use descriptive IDs like `"approach-async"`, `"hypothesis-memory-leak"`, `"alt-database-schema"`

**Pattern:**

```json
// Main line
{ "thought": "Approach A: use Redis caching", "thoughtNumber": 3, "totalThoughts": 6, "nextThoughtNeeded": true }

// Branch from thought 3
{ "thought": "Approach B: use in-memory cache with TTL", "thoughtNumber": 4, "totalThoughts": 6, "nextThoughtNeeded": true, "branchFromThought": 3, "branchId": "in-memory-approach" }
```

## Revision Pattern

Use revision when:

- New information contradicts earlier conclusions
- You realize an assumption was incorrect
- A later step reveals an error in earlier reasoning

**Always specify `revisesThought`** to maintain clear provenance.

**Pattern:**

```json
// Original thought
{ "thought": "The bug is in the authentication layer", "thoughtNumber": 2, "totalThoughts": 5, "nextThoughtNeeded": true }

// Later, you discover new info
{ "thought": "Actually, auth is fine. The issue is in the session middleware — thought 2 was incorrect", "thoughtNumber": 4, "totalThoughts": 5, "nextThoughtNeeded": true, "isRevision": true, "revisesThought": 2 }
```

## Decision Tree

```
START
  │
  ▼
Is this a single-step task? ──────────────────────► SKIP
  │
  No
  ▼
Is the solution immediately obvious? ─────────────► SKIP
  │
  No
  ▼
Will this take > 10 steps? ───────────────────────► CHUNK + USE MCP/TODO
  │
  No
  ▼
Are there multiple valid approaches? ─────────────► USE MCP
  │
  No
  ▼
Could assumptions be wrong? ──────────────────────► USE MCP
  │
  No
  ▼
Is the problem scope unclear? ────────────────────► USE MCP
  │
  No
  ▼
Did initial attempt fail? ────────────────────────► USE MCP
  │
  No
  ▼
SKIP (use direct response)
```

## Anti-Patterns

**Overthinking simple problems:**
- ❌ Using 5 thoughts to decide between `const` and `let`
- ✅ Direct answer based on mutability requirement

**Underthinking complex problems:**
- ❌ Jumping to conclusion without exploring alternatives
- ✅ Using structured reasoning to systematically evaluate

**Infinite loops:**
- ❌ Extending `totalThoughts` indefinitely without progress
- ✅ Set `nextThoughtNeeded: false` when diminishing returns hit

**Thought bloating:**
- ❌ Each thought is a paragraph of text
- ✅ Each thought is one focused insight (1-3 sentences)

**Silent work:**
- ❌ Working through many steps without output
- ✅ Emit progress markers and intermediate results

**Holding output:**
- ❌ Accumulating findings until the end
- ✅ Output incrementally to prevent timeout