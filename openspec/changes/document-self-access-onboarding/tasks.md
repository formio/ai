## 1. Self Access

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests in `packages/skill-tests/src/source-facts/self-access.test.ts`: `roles-and-permissions.md` names `{ "type": "self" }`, `update_own`, and Role Assignment, states the record's `owner` does not matter, and no longer says to write the submission's own `_id` into `owner`; `email-auth.md`'s onboarding workflow names Self Access and a Role Assignment; the planner's canonical `user` resource and both example templates carry the `self` entry; `form-definition.md` describes `self`; no document asks for an `owner` value or generates code to send one

### Green

- [x] 1.2 Rewrite the Self Access entry in `formio-auth/references/roles-and-permissions.md` and extend the onboarding workflow in `email-auth.md`
- [x] 1.3 Add the Self Access entry, its rationale, the `user:role` rule, and a self-check line to the planner; add the entry to both example templates
- [x] 1.4 Describe `self` in `formio-schema`'s form reference and point the submission `owner` row to Self Access

### Refactor

- [x] 1.5 Verify the `owner` question from the server source and live against a local deployment; remove the earlier `owner: ''` guidance and the Angular / React / SDK / API additions built on it; run `pnpm test`, `pnpm lint`, `pnpm format`, and `openspec validate document-self-access-onboarding --strict`
