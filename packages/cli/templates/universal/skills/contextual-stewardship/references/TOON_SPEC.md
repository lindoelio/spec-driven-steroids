# TOON Format Specification for Contextual Stewardship

When generating fallback memory payloads, use the TOON (Token-Oriented Object Notation) format. It is flat, token-efficient, and groups data by domain.

## Syntax Rules

- Define the domain block followed by a colon.
- Define the array schema using `arrayName[numberOfItems]{key1,key2}:`.
- List the items comma-separated.

## Domain Structure

### arquitetura

Stores tech stack choices, design patterns, and tooling decisions.

```
arquitetura:
  padroes[1]{stack,regra}:
    backend,Priorizar Node.js com Drizzle ORM para acesso a dados
```

### negocio

Stores product rules, target audience, and domain logic.

```
negocio:
  produtos[1]{nome,diretriz}:
    ZapDeal AI,Foco inicial em agentes de vendas para food service
```

### fluxo_trabalho

Stores Git patterns, testing conventions, and naming standards.

```
fluxo_trabalho:
  convencoes[1]{tipo,regra}:
    git,Utilizar conventional commits para mensagens de commit
```

## Example Output

When adding multiple decisions across domains:

```text
arquitetura:
  padroes[1]{stack,regra}:
    backend,Priorizar Node.js com Drizzle ORM para acesso a dados

negocio:
  produtos[1]{nome,diretriz}:
    ZapDeal AI,Foco inicial em agentes de vendas para food service

fluxo_trabalho:
  convencoes[1]{tipo,regra}:
    git,Utilizar conventional commits para mensagens de commit
```

## Partial Block Output

If you are only adding one new rule, you do not need to rewrite the whole file. Output only the specific block that applies to the new rule so the orchestrator can append it.

Example for a single arquitetura decision:

```text
arquitetura:
  padroes[1]{stack,regra}:
    backend,Utilizar Svelte para frontend reativo
```
