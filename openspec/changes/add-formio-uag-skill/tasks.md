## 1. formio-uag skill

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests in `packages/skill-tests/src/formio-uag/skill-structure.test.ts`: layout and links of the ten references; the three-clause description naming the owning skills; every `uag*` property in `form-properties.md`; the license split, routes, `agentRunTask` shape, token routes, `uag-js` registration and `Formio.createChat`; a `## Security` section; form writes through `formio-form-builder`'s edit lane; no `action_create` for `agentRunTask`; the UAG URL never recorded with `project_set`; no key in HTML samples; `UAG_LICENSE` only as deprecated; no `persona` in request bodies

### Green

- [x] 1.2 Write `plugin/skills/formio-uag/SKILL.md` and its ten references from the UAG 2.0 developer docs
- [x] 1.3 Add the dev symlink, update library counts, the Security-section list, manifests, READMEs, `CLAUDE.md`, and example prompts
- [x] 1.4 Hand "Agent: Run task" from `formio-actions` and agent work from `formio-form` to `formio-uag`; record the `formio-actions` description in the snapshot fixture

### Refactor

- [x] 1.6 Shorten every description, keeping pinned triggers and handoffs; add the combined budget test (revert-checked: fails at 9,000); re-take the description snapshot; restructure `formio-uag` for compaction; add contents lists; document the listing budget in the READMEs; re-run the routing eval three times
- [x] 1.5 Add routing-eval prompts and run the eval on the base and the change; review the skill against the UAG sources; run `pnpm test`, `pnpm lint` and `pnpm format`
