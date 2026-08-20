## 1. Specs and manifests agree
<!-- depends_on: none -->

### Red

- [x] 1.1 Rewrite the six failing assertions in `packages/mcp-server/src/__tests__/plugin-manifests.test.ts` to the new contract: the Claude manifest declares no `userConfig` and no `env`, and the Cursor manifest declares no `variables` and no `env`
- [x] 1.2 Add an assertion that neither CLI manifest contains any `${VAR}` placeholder — a real claim about the file, replacing a comparison of two now-empty sets
- [x] 1.3 Add an assertion that both manifests' `formio-mcp` entries declare only `command` and `args`
- [x] 1.4 Rewrite `plugin-build.test.ts` case 3.6, which mutates `variables.properties.FORMIO_BASE_URL` to prove a mismatch is caught — the smoke test must still catch a placeholder with no declaration, so drive it by ADDING an undeclared placeholder rather than deleting a declaration
- [x] 1.5 Rewrite the four failing assertions in `packages/skill-tests/src/shipped-surface/project-url-variables.test.ts`, keeping the desktop-bundle assertions untouched
- [x] 1.6 Add an assertion that `scripts/build-mcpb.ts` still declares `formio_base_url`, so the deliberate asymmetry cannot be silently "cleaned up"

### Green

- [x] 1.7 Confirm both manifests already match (the working tree edit) and make no further change to them
- [x] 1.8 Apply the two delta specs to `openspec/specs/claude-plugin-packaging/spec.md` and `openspec/specs/agent-plugin-packaging/spec.md`

### Refactor

- [x] 1.9 Review and refactor as needed

## 2. Prose that still describes the prompt
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing assertion that no skill document claims the shipped plugin manifests set `FORMIO_BASE_URL` from an install-time prompt

### Green

- [x] 2.2 Correct `plugin/skills/formio-mcp-setup/SKILL.md`, which states the manifests set it from the install-time prompt and the `.mcpb` bundle from its user config — only the second half remains true
- [x] 2.3 Correct the environment tables in `plugin/README.md` and `README.md` where they describe the CLI install prompt
- [x] 2.4 Write a changeset recording the removal, the affected cohort, the one-time remedy, and that it is NOT breaking — with the reason: resolution reports what is missing and names the command that fixes it

### Refactor

- [x] 2.5 Review and refactor as needed

## 3. Repo checks
<!-- depends_on: 1, 2 -->

### Green

- [x] 3.1 Run `pnpm test`, `pnpm lint`, and `pnpm format`; prose-wrap only the skill markdown this change edits
- [x] 3.2 Confirm the full suite returns to exactly one pre-existing failure — the README install matrix, which predates this session — with no plugin-manifest failures left

### Refactor

- [x] 3.3 Review and refactor as needed
