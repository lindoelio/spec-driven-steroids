# Spec-Driven Steroids 💪

> Inject Spec-Driven workflow into your favorite AI Agents. Rigorous. Simple. Frictionless.

[![npm version](https://img.shields.io/npm/v/spec-driven-steroids.svg)](https://www.npmjs.com/package/spec-driven-steroids)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Overview

**Spec-Driven Steroids** brings discipline to AI-powered software engineering by injecting high-standard workflows (Spec-Driven Development) directly into your AI tools.

**Key Features:**

- **Platform Native** - Work entirely within your existing AI chat (no new UI)
- **Strict Enforcement** - MCP-powered validation for AI-generated specs
- **Rigorous Flow** - Requirements (EARS) → Technical Design (Mermaid) → Atomic Tasks → Implementation

**Supported Platforms:**

- GitHub Copilot (VS Code and JetBrains IDEs)
- Google Antigravity
- OpenCode

---

## Installation

```bash
npm install -g spec-driven-steroids
```

**Requirements:** Node.js `>=20.0.0`

---

## Quick Start

### 1. Inject into Your Project

Navigate to your repository and run:

```bash
spec-driven-steroids inject
```

Select your AI platform to scaffold the necessary configuration files.

### 2. Generate Project Guidelines (Recommended)

Use the `/inject-guidelines` command to generate comprehensive project documentation:

```bash
# In your AI chat:
/inject-guidelines
```

This creates `AGENTS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, `TESTING.md`, `ARCHITECTURE.md`, and `SECURITY.md`.

### 3. Plan a Feature

Use your AI assistant with the spec-driven agent:

- **GitHub Copilot:** `@spec-driven I want to add a rate limiter to my API.`
- **OpenCode:** Switch to the Spec-Driven agent (Tab) and describe your feature
- **Antigravity:** `/spec-driven`

The agent generates `specs/changes/<slug>/requirements.md`, `design.md`, and `tasks.md`.

### 4. Implement

Switch to your build agent and reference the generated tasks:

- **GitHub Copilot:** `@copilot Implement the rate limiter following specs/changes/rate-limiter/tasks.md`
- **OpenCode:** Switch to Build agent - it reads the spec and implements with traceability

---

## MCP Validation Tools

The package includes a Model Context Protocol (MCP) server with 5 validation tools:

| Tool                       | Purpose              |
| -------------------------- | -------------------- |
| `verify_spec_structure`    | Folder structure     |
| `verify_requirements_file` | Requirements content |
| `verify_design_file`       | Design content       |
| `verify_tasks_file`        | Tasks content        |
| `verify_complete_spec`     | Complete workflow    |

---

## Standards

- **EARS** - Easy Approach to Requirements Syntax (WHEN, IF, THEN, SHALL, WHILE, WHERE)
- **Mermaid** - Standard visualization for architecture and sequence diagrams
- **Folder Convention** - `specs/changes/<slug>/[requirements.md | design.md | tasks.md]`
- **Traceability** - Every design and task must link back to a requirement ID

---

## Documentation

- **[GitHub Repository](https://github.com/lindoelio/spec-driven-steroids)** - Full documentation and source code
- **[Contributing Guide](https://github.com/lindoelio/spec-driven-steroids/blob/main/CONTRIBUTING.md)** - How to contribute
- **[Issues](https://github.com/lindoelio/spec-driven-steroids/issues)** - Report bugs or request features

---

## License

MIT © [Lindoélio Lázaro](https://github.com/lindoelio)
