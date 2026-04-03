---
name: long-running-work-planning
description: Use this skill when facing complex problems requiring multi-step reasoning, architectural decisions, debugging with unclear root causes, or tasks where the problem scope is uncertain. Invoke even if the user doesn't explicitly mention "reasoning" or "thinking through" — triggers on phrases like "figure out why", "analyze this", "what's the best approach", or when initial attempts fail.
license: MIT
allowed-tools: mcp__sequentialthinking__sequentialthinking
---

# Long-Running Work Planning

Maintain work continuity across extended tasks. Break down ambiguous problems, explore alternatives, and prevent timeout errors by working in structured increments.

## Strategy Selection

Choose your continuity strategy based on available tooling:

```
Agent Starts Complex Task
    │
    ▼
Sequential-Thinking MCP Available?
    ├─ Yes → Use MCP for Structured Reasoning
    │         │
    │         ▼
    │     To-Do Tools Available?
    │         ├─ Yes → ⭐ Combine: MCP + To-Do (Recommended)
    │         └─ No  → Use MCP Alone
    │
    └─ No → To-Do Tools Available?
              ├─ Yes → Use To-Do for Task Decomposition
              └─ No  → Use Manual Chunking Strategy
```

### Strategy 1: Sequential-Thinking MCP (Primary)

Use when the MCP server is configured. Provides structured reasoning with revision and branching support.

```javascript
mcp__sequentialthinking__sequentialthinking({
  thought: "First, I need to understand what's causing the intermittent failure...",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
})
```

### Strategy 2: To-Do Tools (Secondary)

Use when MCP is not available but built-in to-do tools are. Break tasks into visible, trackable steps.

**Pattern:**
1. Create a to-do list with all identified steps
2. Mark tasks as in-progress when starting
3. Mark tasks as complete after verification
4. Maintain visible progress throughout

**Best for:**
- Task decomposition with clear steps
- Work that benefits from visible progress tracking
- Environments where users want to see incremental progress

### Strategy 3: Manual Chunking (Fallback)

Use when neither MCP nor to-do tools are available.

**Pattern:**
1. Identify the total scope of work
2. Break into 3-5 step chunks
3. Output each chunk with a clear progress marker
4. Summarize before moving to next chunk

**Example:**
```
[Progress 1/3] Analyzing the problem scope...
<output analysis>

[Progress 2/3] Evaluating potential solutions...
<output evaluation>

[Progress 3/3] Recommending approach...
<output recommendation>
```

### Strategy 4: Combined MCP + To-Do (Recommended)

**Use both together for maximum effectiveness:**
- **Sequential-thinking MCP**: Provides structured reasoning, revision tracking, and branching
- **To-do tools**: Provides visible progress tracking for the user

**Pattern:**
1. Use to-do to create a visible task breakdown
2. Use sequential-thinking MCP for complex reasoning within each task
3. Update to-do status as reasoning progresses
4. Emit intermediate results to prevent timeout

**Per-Phase Todo Lists:** When running a spec-driven phase skill that defines its own Per-Phase Todo List section, use that phase-scoped list instead of creating a generic one. The per-phase list takes precedence over this generic strategy.

## When to Use

| Trigger Pattern | Example |
|-----------------|---------|
| Problem scope unclear | "Something's wrong with the API but I'm not sure what" |
| Multi-step reasoning required | "Help me design a caching strategy" |
| Root cause unknown | "This bug only happens under load" |
| Multiple valid approaches | "Should I use PostgreSQL or MongoDB for this?" |
| Initial attempt failed | "I tried fixing it but it's still broken" |
| Architectural decisions | "How should I structure the microservices?" |
| Complex debugging | "The race condition is hard to reproduce" |
| Long-running tasks | "Write a technical design for this feature" |

## When to SKIP

Do NOT use this skill for:

| Skip Pattern | Why |
|--------------|-----|
| Simple lookups | "What's the capital of France?" |
| Known solutions | "Add error handling to this function" |
| Formatting tasks | "Convert this JSON to YAML" |
| Single-step edits | "Rename this variable" |
| Factual queries | "What does `git rebase` do?" |
| Trivial calculations | "Sum these numbers" |
| Straightforward implementations | "Create a login form with these fields" |

## Timeout Prevention

### Threshold Indicators

Watch for these signs that you're approaching timeout risk:

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Estimated steps > 10 | High | Chunk immediately, use MCP or to-do |
| Complex multi-file changes | High | Break into phases, output incrementally |
| Ambiguous requirements | Medium | Clarify first, then chunk |
| No clear end state | Medium | Define success criteria, then chunk |
| New domain/concept | Medium | Research phase, then chunk |

### Proactive Chunking

**Before starting complex work:**

1. **Estimate scope**: How many distinct steps? How many files affected?
2. **Check thresholds**: If steps > 10 or files > 5, chunk first
3. **Choose strategy**: MCP preferred, to-do secondary, manual fallback
4. **Output plan**: Share the chunking plan before diving in

### Incremental Output Patterns

**Pattern A: Phase-Based Output**
```
## Phase 1: Analysis
<output analysis results>

## Phase 2: Design
<output design decisions>

## Phase 3: Implementation Plan
<output task breakdown>
```

**Pattern B: Progress Markers**
```
[1/5] Setting up the foundation...
[2/5] Building core components...
[3/5] Adding integrations...
[4/5] Testing and validation...
[5/5] Documentation and cleanup...
```

**Pattern C: Checkpoint-Based**
```
Checkpoint: Requirements understood
<output>

Checkpoint: Design approach selected
<output>

Checkpoint: Implementation complete
<output>
```

### Anti-Pattern: Holding Output

❌ **Bad**: Working through 15 steps internally, then outputting everything at once
✅ **Good**: Outputting after every 2-3 steps with progress markers

## MCP Tool Reference

### Sequential-Thinking MCP Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `thought` | Yes | Current reasoning step |
| `thoughtNumber` | Yes | Current step number (1-indexed) |
| `totalThoughts` | Yes | Estimated total steps needed |
| `nextThoughtNeeded` | Yes | `true` if more steps needed |
| `isRevision` | No | Mark as revision of previous thought |
| `revisesThought` | No | Which thought number is being revised |
| `branchFromThought` | No | Branch point thought number |
| `branchId` | No | Identifier for the branch |
| `needsMoreThoughts` | No | Request more thoughts than estimated |

### Core Patterns

#### Linear Progression

Standard step-by-step reasoning:

```json
{ "thought": "Analyze the error stack trace...", "thoughtNumber": 1, "totalThoughts": 4, "nextThoughtNeeded": true }
{ "thought": "Identify the failing component...", "thoughtNumber": 2, "totalThoughts": 4, "nextThoughtNeeded": true }
{ "thought": "Trace the data flow...", "thoughtNumber": 3, "totalThoughts": 4, "nextThoughtNeeded": true }
{ "thought": "Root cause is X, fix is Y", "thoughtNumber": 4, "totalThoughts": 4, "nextThoughtNeeded": false }
```

#### Revision

Correct previous reasoning:

```json
{ "thought": "Wait, my assumption in thought 2 was wrong...", "thoughtNumber": 3, "totalThoughts": 5, "nextThoughtNeeded": true, "isRevision": true, "revisesThought": 2 }
```

#### Branching

Explore alternatives:

```json
{ "thought": "Alternative approach: what if we use async/await instead?", "thoughtNumber": 4, "totalThoughts": 6, "nextThoughtNeeded": true, "branchFromThought": 3, "branchId": "async-approach" }
```

### Timeout Prevention with MCP

**1. Start conservative:** Estimate `totalThoughts` at 3-5 for most problems. Extend with `needsMoreThoughts: true` if needed.

**2. Chunk reasoning:** If approaching 10+ thoughts, summarize findings and restart the sequence.

**3. Dynamic adjustment:** Set `nextThoughtNeeded: false` early if the answer becomes clear.

**4. Avoid overthinking:** If 3 consecutive thoughts don't add value, conclude.

## Examples

### Example: Complex Debugging (USE tool)

User: "My API works locally but fails in production sporadically"

```
Thought 1: "List differences between local and production environments..."
Thought 2: "Check for race conditions in shared state..."
Thought 3: "Investigate timeout configurations..."
Thought 4: "Production has different load balancer settings causing session affinity issues"
```

### Example: Long Design Task (USE tool + to-do)

User: "Design the architecture for a new payment system"

**To-do list created (or use the Per-Phase Todo List from the active spec-driven skill):**
1. Gather requirements
2. Design data models
3. Design API contracts
4. Design integration points
5. Document decisions

If a spec-driven phase skill (e.g., `spec-driven-technical-designer`) is active, its Per-Phase Todo List takes precedence and should be used instead of this generic breakdown.

**Then use MCP for each phase of reasoning.**

### Example: Simple Task (SKIP tool)

User: "Add a README file to this project"

Direct response. No structured reasoning needed — straightforward single-step task.

## Reference

For detailed decision frameworks and advanced patterns, see [references/decision-framework.md](references/decision-framework.md).