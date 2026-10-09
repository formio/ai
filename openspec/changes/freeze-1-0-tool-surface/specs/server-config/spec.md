## ADDED Requirements

### Requirement: Boolean environment variables share one parser

Every boolean environment variable the server reads (`FORMIO_INSECURE_TLS`, `FORMIO_FORCE_BROWSER`) SHALL be read by one parser: after trimming, `true` and `1` (case-insensitive) are true and every other value, including unset, is false.

#### Scenario: Same spelling, same meaning

- **WHEN** `FORMIO_FORCE_BROWSER` is `TRUE` and `FORMIO_INSECURE_TLS` is ` 1 `
- **THEN** both are read as true

### Requirement: The package publishes its binary and no library entry

`@formio/mcp`'s `package.json` SHALL declare `exports` exposing only `./package.json`, so that no module under `dist/` is importable by consumers; the package's interface is its `formio-mcp` binary.

#### Scenario: No deep import

- **WHEN** a consumer imports `@formio/mcp/dist/server.js`
- **THEN** module resolution fails with a package-exports error
