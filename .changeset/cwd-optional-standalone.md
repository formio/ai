---
'@formio/mcp': minor
---

Make `cwd` optional when not running as the Claude Code plugin. The per-directory project map is only consulted in plugin context, so standalone and container callers were being asked for a value that could not affect the result — and were pointed at `project_set`, which is not registered outside the plugin. `cwd` stays required in plugin context, where the mapping is authoritative.
