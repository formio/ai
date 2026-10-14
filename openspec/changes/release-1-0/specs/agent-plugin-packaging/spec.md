## ADDED Requirements

### Requirement: A local plugin build launches the bundled server

`pnpm build:plugin:local` SHALL build the plugin and write `dist/plugin-local`, a copy of the built plugin whose every manifest that declares the `formio-mcp` server — `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, and `mcp.json` — launches the bundled `server/stdio.mjs` by absolute path with `node`, adding `--use-system-ca` when the running Node accepts it, instead of `npx @formio/mcp@<version>`. The published `dist/plugin` and the `plugin/` sources SHALL be unchanged by it.

#### Scenario: Local manifests launch the bundled server

- **WHEN** `pnpm build:plugin:local` has run
- **THEN** every `formio-mcp` entry in `dist/plugin-local`'s manifests runs `node` with the absolute path of `dist/plugin-local/server/stdio.mjs`
- **AND** no manifest under `dist/plugin` or `plugin/` changed

#### Scenario: The local server serves the current tool surface

- **WHEN** the local plugin's server is started and lists its tools
- **THEN** it lists every tool the source registers
