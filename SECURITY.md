# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately via one of:

- Email: [security@form.io](mailto:security@form.io)
- GitHub: [privately report a vulnerability](https://github.com/formio/ai/security/advisories/new) on this repository

Include a description of the issue, steps to reproduce, and the affected package (`@formio/mcp`, `@formio/ai`) and version. We will acknowledge receipt within 5 business days.

## Supported versions

Only the latest published version of each package receives security fixes.

## Scope notes

- The MCP server runs locally and authenticates against your own Form.io deployment; it never proxies credentials through third parties. JWTs are written to disk under ~/.formio/mcp-tokens.json and persist between sessions. The MCP server also creates an ephemeral in-memory JWT cache.
- `FORMIO_INSECURE_TLS=true` disables TLS certificate verification and is intended solely for self-hosted development environments — never use it against production.
