---
'@formio/mcp': patch
'@formio/ai': patch
---

Guard the skills and the server against drifting from the code and the deployment they describe.

- `tools/list` no longer carries a `$schema` key on every input and output schema, and the three update tools share a shorter overwrite sentence: the list drops from 41,436 to 38,679 characters.
- `pnpm test:live` (opt-in) calls every tool against a real Form.io project the repository folder resolves to, refusing unless it matches `FORMIO_LIVE_TEST_PROJECT`, and cleans up after itself.
- Skill examples are checked against the installed `@formio/js`, `@formio/core`, and `@formio/react`; skill text is checked against the tools' real names, arguments, and enum values; the preflight's list of writing tools is derived from the tool annotations.
- `formio-react` and `formio-angular` read package versions, peers, and engines with `npm view` at run time instead of stating them.
- `formio-mcp-setup`'s "too old" section keeps its upgrade paths and loses a dead branch and its version notes.
