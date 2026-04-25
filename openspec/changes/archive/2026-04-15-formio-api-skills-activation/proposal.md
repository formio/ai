## Why

The Form.io API skills library at `skills/formio-api/` is content-complete, but Claude will not activate any of it for two reasons: (1) the files do not live in a discoverable skill location (Claude Code loads skills from `.claude/skills/<name>/SKILL.md`, not from arbitrary repo paths with flat file names), and (2) every skill `description` states capability ("Project-scope Forms API — list, filter, create, update…") without a trigger clause that tells Claude *when* to pick the skill for a user request. We also never tell Claude to prefer the MCP server's first-party tools (`form_create`, `form_get`, `form_list`, `form_update`) over raw HTTP when both paths exist. Fixing these three gaps unlocks the value already written.

## What Changes

- Relocate the skill library to a Claude-discoverable layout: `.claude/skills/formio-api-<group>/SKILL.md` (17 skill directories, one `SKILL.md` each). The old flat `skills/formio-api/` path is removed — **BREAKING** for any tooling that references those paths.
- Rewrite every skill `description` to include an explicit "Use when the user asks to …" trigger clause, 2–3 user-language synonyms (e.g., "record", "entry", "response" alongside "submission"; "environment" alongside "project"), and a "Not for: …" negative-trigger clause where sibling scopes overlap at `FORMIO_PROJECT_URL`.
- Add a new required section to every skill body, `## MCP Tool Preference`, that instructs Claude to prefer the matching MCP tool (`form_*`) when one exists and fall back to the HTTP endpoint only when no tool covers the operation. Skills without any matching MCP tool still include the section and state "No MCP tool covers this operation — use the HTTP endpoint directly."
- Update the router index to live at `.claude/skills/formio-api/SKILL.md` and document its role as the capability map; it remains a pointer-only document (no endpoint headings).
- Extend `skills-validator.ts` to enforce: new filesystem layout, `description` must contain a trigger phrase (`Use when` or `use when`), negative-trigger clause present for overlap-prone scopes (`project` and `runtime`), and the `## MCP Tool Preference` section is present in every capability-group skill.
- Update `packages/mcp-server/src/__tests__/skills-library.test.ts` to exercise the new validator rules and the new library root path.
- Update `CLAUDE.md` and root `README.md` pointers to the new library location.
- **Non-goals**: no new MCP tools, no changes to the PKCE-JWT auth paragraph, no changes to the scope map (platform / project / runtime / pdf).

## Capabilities

### New Capabilities

- `api-skills-discovery`: Where skills live on disk and how they are named so Claude Code's skill loader finds and enumerates them. Covers directory layout, `SKILL.md` naming, router placement, and the validator rules that enforce the layout.
- `api-skills-activation`: How skill `description` fields and skill bodies are authored so Claude selects the correct skill for a user request. Covers trigger-phrase requirement, synonym coverage, negative triggers between overlapping scopes, the `## MCP Tool Preference` section contract, and the validator rules that enforce these authoring requirements.

### Modified Capabilities

<!-- None in openspec/specs/ are modified. The sibling change `formio-api/references/skills-library` introduces `api-skills-library`, `api-skills-authoring`, and `api-skills-validation` but has not been archived, so those are not yet specs under openspec/specs/. This change adds new capabilities alongside them rather than editing unarchived drafts. -->

## Impact

- **Moved directory**: `skills/formio-api/` → `.claude/skills/formio-api-<group>/SKILL.md` (17 directories) plus `.claude/skills/formio-api/SKILL.md` as the router. The old path is deleted.
- **Rewritten content**: every skill's frontmatter `description` and every skill's body gains a `## MCP Tool Preference` section.
- **Validator**: `packages/mcp-server/src/skills-validator.ts` gains rules for trigger phrasing, negative triggers, MCP Tool Preference section, and the updated library root path. `REQUIRED_SKILL_FILES` and `INDEX_FILENAME` constants change shape.
- **Tests**: `packages/mcp-server/src/__tests__/skills-library.test.ts` expands to cover the new validator rules; fixture paths update.
- **Docs**: `CLAUDE.md` "Skills Library" section and root `README.md` links updated to the new location.
- **No runtime code changes** in the MCP server itself — skill content is consumed by Claude, not by the server.
- **Dependencies**: none added.
