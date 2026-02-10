# Security Policy

<!-- SpecDriven:managed:start -->

## Supported Scope

This repository includes:

- CLI tooling that writes files into target repositories.
- MCP server logic that validates user-provided spec content.
- Markdown template distribution for AI agents and skills.

## Reporting Vulnerabilities

Please report suspected vulnerabilities privately before public disclosure.

- Preferred: GitHub Security Advisory for this repository.
- Fallback: contact maintainers via repository owner contact.

Include reproduction steps, affected paths, and impact assessment.

## Security Practices

- Do not commit secrets, API keys, tokens, or credential files.
- Validate and constrain file paths for filesystem operations.
- Wrap external/process boundaries in `try/catch` and fail with clear messages.
- Keep dependencies current and review changelogs for security updates.
- Use least privilege for any MCP/API integrations configured by generated files.

## Safe Contribution Expectations

- Avoid introducing shell command injection vectors in CLI prompts/inputs.
- Treat user-provided Markdown/spec files as untrusted content.
- Avoid logging sensitive environment values in errors or debug output.
- Document security-relevant behavior changes in PR descriptions.

## Release Hygiene

- Run `pnpm build`, `pnpm lint`, and `pnpm test` before release.
- Verify published artifacts only include intended files.
- If a vulnerability is confirmed, prioritize patch release and remediation notes.

See `TESTING.md` for validation workflow and `ARCHITECTURE.md` for system boundaries.

<!-- SpecDriven:managed:end -->
