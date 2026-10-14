---
'@formio/ai': patch
'@formio/mcp': patch
---

- The Claude Code plugin runs the server it carries — `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.js` — instead of `npx -y @formio/mcp@<version>`. Claude Code installs that server's dependencies from the plugin's `package-lock.json`, which pins every package to the version this release was tested with, by registry URL and integrity hash. A pinned `npx` fixed the package but not its dependencies, which resolved at install time to versions no test had run against. The Cursor and Agent Plugins manifests, the MCP Registry entry, the desktop bundle, and the documented manual setup keep the `npx` launch.
- On a network that reaches npm only through a private mirror, Claude Code's dependency install cannot reach the registry, because it does not read `.npmrc`; `formio-mcp-setup` now routes that case to its `npx` configuration, which does.
- The server reports its version from a module stamped at release time rather than from a `package.json` read, so every form it ships in reports the `@formio/mcp` version.
- The Claude Code manifest names the plugin icon.
