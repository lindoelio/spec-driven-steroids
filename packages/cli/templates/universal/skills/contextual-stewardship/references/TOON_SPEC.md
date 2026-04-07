# TOON Format Specification for Contextual Stewardship

When generating fallback memory payloads, use the TOON (Token-Oriented Object Notation) format. It is flat, token-efficient, and groups data by domain.

## Syntax Rules

- Define the domain block followed by a colon.
- Define the array schema using `arrayName[numberOfItems]{key1,key2}:`.
- List the items comma-separated.

## Domain Structure

### architecture

Stores tech stack choices, design patterns, and tooling decisions.

```
architecture:
  patterns[1]{stack,rule}:
    backend,Prioritize Node.js with Drizzle ORM for data access
```

### business

Stores product rules, target audience, and domain logic.

```
business:
  products[1]{name,guideline}:
    Example App,Initial focus on sales agents for food service
```

### workflow

Stores Git patterns, testing conventions, and naming standards.

```
workflow:
  conventions[1]{type,rule}:
    git,Use conventional commits for commit messages
```

## Example Output

When adding multiple decisions across domains:

```text
architecture:
  patterns[1]{stack,rule}:
    backend,Prioritize Node.js with Drizzle ORM for data access

business:
  products[1]{name,guideline}:
    Example App,Initial focus on sales agents for food service

workflow:
  conventions[1]{type,rule}:
    git,Use conventional commits for commit messages
```

## Partial Block Output

If you are only adding one new rule, you do not need to rewrite the whole file. Output only the specific block that applies to the new rule so the orchestrator can append it.

Example for a single architecture decision:

```text
architecture:
  patterns[1]{stack,rule}:
    frontend,Use Svelte for reactive frontend
```
