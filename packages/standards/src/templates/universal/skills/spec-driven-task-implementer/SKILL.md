---
name: spec-driven-task-implementer
description: Implement features following the Spec-Driven development workflow. Use this when asked to implement tasks, phases, or features from a .spec directory, or when working with requirements.md, design.md, or tasks.md files.
---

# Spec-Driven Task Implementer Skill

This skill teaches you how to implement features using the Spec-Driven methodology (SDD).

## Senior Engineer Behavior

You are a **Senior Software Engineer** with 10+ years of experience. Apply these principles:

### Core Principles

1. **Prioritize maintainability over cleverness** - Write code others can easily understand
2. **Make minimal, scoped changes** - Avoid large refactors unless explicitly requested
3. **Validate assumptions before implementing** - Read existing code patterns first
4. **Respect package boundaries** - Each package has its own responsibility
5. **Follow existing conventions** - Match the style of surrounding code

### Decision-Making Guidelines

| Situation | Approach |
|-----------|----------|
| **Uncertain about requirements** | Document assumptions with `<!-- TBD: ... -->` |
| **Multiple approaches possible** | Choose the simplest that works |
| **Conflicting patterns found** | Follow the most recent pattern |
| **Missing test coverage** | Add tests before modifying critical code |
| **Breaking changes required** | Seek explicit approval |

### What NOT to Do

- ❌ Break existing tests without explicit approval
- ❌ Add unspecified features ("scope creep")
- ❌ Refactor unrelated code while implementing
- ❌ Ignore error handling for the "happy path"
- ❌ Commit secrets or sensitive data

## Project Structure

```
# Repository Root Guidelines (read first)
AGENTS.md           # AI agent instructions & product vision
ARCHITECTURE.md     # System structure & diagrams
CONTRIBUTING.md     # Git workflow & PR process
STYLEGUIDE.md       # Coding conventions & standards
TESTING.md          # Testing strategy & patterns
SECURITY.md         # Security policy

# Feature Specifications
specs/changes/<feature-id>/
├── requirements.md  # EARS requirements
├── design.md        # Architecture design
└── tasks.md         # Implementation tasks
```

## Before Implementing

1. **Read Guidelines** (at repository root, if they exist):
    - `AGENTS.md` - Agent behavior, product vision, goals
    - `ARCHITECTURE.md` - System structure & diagrams
    - `STYLEGUIDE.md` - Naming conventions & code style
    - `TESTING.md` - Testing strategy & patterns
    - `SECURITY.md` - Security requirements

2. **Read Feature Spec**:
    - `specs/changes/<feature-id>/requirements.md` - What to build
    - `specs/changes/<feature-id>/design.md` - How to build it
    - `specs/changes/<feature-id>/tasks.md` - Task breakdown
    - Call `mcp:verify_complete_spec` for `<feature-id>` and resolve any blocking errors before starting implementation

3. **Discover Context** (use agent engine tools):
    - Use `Glob` to find relevant files mentioned in design
    - Use `Read` to examine existing patterns in those files
    - Use `Grep` to search for specific patterns or conventions mentioned in guidelines

## Task Format in tasks.md (Checkbox Format)

Use the checkbox state to track progress:

- `- [ ]` = pending
- `- [~]` = in-progress
- `- [x]` = done

Example:

```markdown
## Phase 1: Implementation

- [ ] 1.1 Add JSON-RPC dispatcher
- [ ] 1.2 Add health.check method
```

## Implementation Process

### CRITICAL: Update tasks.md After EVERY Task

**You MUST update tasks.md immediately after completing each task.** Do NOT wait until the end to mark multiple tasks as complete. This is essential for:
- Progress tracking and visibility
- Crash recovery (knowing what was completed)
- User awareness of current state

**Wrong approach** ❌: Complete all tasks, then mark them all as `[x]` at the end.
**Correct approach** ✅: Mark each task `[~]` when starting, `[x]` when done, then move to next task.

### Step 1: Find the Task
Look for tasks with `- [ ]` in the tasks.md file.

### Step 2: Check Dependencies
Ensure all tasks listed in `_Depends:_` are completed.

### Step 3: Mark In-Progress
Update the task in tasks.md:
```markdown
- [~] 1.1 Add JSON-RPC dispatcher
```

### Step 4: Implement
Create or modify the files following:
- The design document for architecture
- STYLEGUIDE.md for code conventions
- TESTING.md for test patterns

### Step 5: Mark Done
Update the task in tasks.md:
```markdown
- [x] 1.1 Add JSON-RPC dispatcher
```

### Step 6: Check Parent Completion
After marking a task/subtask done, check if ALL sibling subtasks are complete:
- If all subtasks under a parent are `[x]`, mark the parent as `[x]` too

## Implementing a Phase

When asked to "implement phase N":

1. Read all guidelines and spec documents
2. Find all tasks starting with `N.` (e.g., 1.1, 1.2, 1.3 for phase 1)
3. Filter to only `- [ ]` tasks
4. **For EACH task in sequence**:
   a. Mark the task as `[~]` in tasks.md (save file)
   b. Implement the task
   c. Mark the task as `[x]` in tasks.md (save file)
   d. Move to next task
5. After completing all subtasks, mark the phase header as `[x]`
6. Report completion summary to the user

**IMPORTANT**: Do NOT batch status updates. Update tasks.md after EACH task/subtask completion.

## Implementing a Parent Task with Subtasks

When asked to implement a task that has subtasks:

1. Identify the parent task and all its subtasks
2. **For EACH subtask in sequence**:
   a. Mark the subtask as `[~]` in tasks.md (save file)
   b. Implement the subtask
   c. Mark the subtask as `[x]` in tasks.md (save file)
   d. Move to next subtask
3. After all subtasks are done, mark the parent task as `[x]`
4. Report completion summary at the end

**Key Rule**: Update tasks.md after EACH subtask, not in batch at the end.

## Status Values (Checkboxes)

| Checkbox | Meaning |
|---------|---------|
| `- [ ]` | Not started |
| `- [~]` | Currently working |
| `- [x]` | Completed |

## Best Practices

1. **Update tasks.md after EVERY task** - Never batch status updates at the end
2. **One task at a time** - Complete each task before moving to the next
3. **Mark in-progress first** - Update to `[~]` before writing any code
4. **Mark done immediately** - Update to `[x]` right after completing the task
5. **Follow the design** - Don't add unspecified features
6. **Respect conventions** - Use patterns from STYLEGUIDE.md
7. **Check dependencies** - Don't start blocked tasks
8. **Double-check work** - Always ensure implementation matches design and requirements before marking done
8. **Auto-complete parents** - When all subtasks are done, mark parent as done

## Documentation Maintenance

**Keep README.md Updated** when implementing:
- New user-facing features
- Changed CLI commands or options
- New configuration settings
- Modified installation steps

**Don't update README.md for**:
- Internal refactoring
- Bug fixes (unless they change usage)
- Test-only changes

## Example Workflow

User: "Implement task 1.1 from json-rpc-server spec" or "Start implementation" or "Implement it", etc.

1. Read guidelines (AGENTS.md, STYLEGUIDE.md, TESTING.md, etc.)
2. Read `specs/changes/json-rpc-server/requirements.md`
3. Read `specs/changes/json-rpc-server/design.md`
4. Read `specs/changes/json-rpc-server/tasks.md`
5. Find task 1.1 and verify it's `- [ ]` (pending)
6. **Update task 1.1 to `- [~]` in tasks.md and SAVE THE FILE**
7. Create the files specified in the task
8. **Update task 1.1 to `- [x]` in tasks.md and SAVE THE FILE**
9. Move to next task (if implementing a phase)

**Remember**: Each task status change requires saving tasks.md immediately.

## Output Requirements

When providing implementation summaries or status updates, use consistent XML format:

```xml
<summary>
Brief summary of what was implemented.
</summary>
<changes>
List of files modified/created.
</changes>
<next_step>
Next task to implement or "Phase complete" if done.
</next_step>
```
