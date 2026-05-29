## 1. Author submission reference files
<!-- depends_on: none -->

### Red

- [x] 1.1 Update `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts` so the "placeholder domains" loop only covers `project`, and add a new `describe` block asserting `plugin/skills/formio-schema/references/submission/` contains exactly `submission-definition.md`, `submission-state.md`, `submission-metadata.md`, `submission-access.md`, `submission-data.md`, that none of them carry YAML frontmatter, and that `submission/README.md` does not exist — these assertions should fail against the current placeholder layout
- [x] 1.2 Extend the new submission `describe` block with body assertions: `submission-definition.md` mentions every top-level Submission property name (`_id`, `_fvid`, `form`, `project`, `owner`, `roles`, `state`, `access`, `metadata`, `data`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`); `submission-state.md` mentions both `draft` and `submitted`; `submission-metadata.md` mentions every documented metadata key (`timezone`, `offset`, `origin`, `referrer`, `browserName`, `userAgent`, `pathName`, `onLine`, `language`, `headers`, `ssoteam`, `memberCount`, `selectData`) plus the word "extensible" (or equivalent); `submission-access.md` mentions every AccessType value (`self`, `create_own`, `create_all`, `read_own`, `read_all`, `update_own`, `update_all`, `delete_own`, `delete_all`, `team_read`, `team_write`, `team_admin`, `team_access`); `submission-data.md` references at least one path under `references/form/`

### Green

- [x] 1.3 Delete `plugin/skills/formio-schema/references/submission/README.md`
- [x] 1.4 Author `plugin/skills/formio-schema/references/submission/submission-definition.md` with a top-level heading, an intro paragraph defining what a submission is (per the user guide), a property table covering every field declared on the TypeScript `Submission` interface (`_id`, `_fvid`, `form`, `project`, `owner`, `roles`, `state`, `access`, `metadata`, `data`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`) with type / required / description columns, and cross-links to `submission-state.md`, `submission-metadata.md`, `submission-access.md`, and `submission-data.md`
- [x] 1.5 Author `plugin/skills/formio-schema/references/submission/submission-state.md` documenting both `"draft"` (unsaved/in-progress) and `"submitted"` (completed) state values, when each is written, the user-guide note about draft state, and the one-line callout that the upstream TypeScript currently declares only `"submitted"` as a known narrowing gap
- [x] 1.6 Author `plugin/skills/formio-schema/references/submission/submission-metadata.md` with the `SubmissionMetadata` shape, a property table covering every documented key (`ssoteam`, `memberCount`, `selectData`, `timezone`, `offset`, `origin`, `referrer`, `browserName`, `userAgent`, `pathName`, `onLine`, `language`, `headers`), and a callout that the object is extensible via an open `[key: string]: any` index signature
- [x] 1.7 Author `plugin/skills/formio-schema/references/submission/submission-access.md` documenting the row-level `access` array shape (`{ type, roles, resources? }`), enumerating every AccessType value with a short description of each, and explaining how the row-level `access` array overrides the form-level `submissionAccess` for that specific submission
- [x] 1.8 Author `plugin/skills/formio-schema/references/submission/submission-data.md` documenting the `data` envelope: key-to-path mapping, nesting under container / datagrid / editgrid / datamap / nested form / address components, the address discriminated union (autocomplete vs manual mode) as the worked example, and cross-links to `references/form/input-components.md` and `references/form/data-components.md` for per-component value shapes

### Refactor

- [x] 1.9 Review implementation and refactor as needed

## 2. Update router SKILL.md to index the submission domain
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Extend the layout test's existing "body indexes every domain" `describe` block: add an assertion that the router body references all five `references/submission/submission-*.md` paths, and an assertion that the router body does NOT reference `references/submission/README.md`
- [x] 2.2 Update the existing "Router enumerates the placeholder domains" assertion to expect only the project placeholder (`references/project/README.md`); the submission domain is no longer a placeholder

### Green

- [x] 2.3 Edit `plugin/skills/formio-schema/SKILL.md`: split the "Submissions and Projects" section into a "Submissions" subsection with a multi-row table listing every submission reference (path + one-line "Working on…" cue) and a separate "Projects" subsection containing the still-placeholder project row; update the trigger clause so submission-specific phrases (interpreting a submission, decoding submission `data`, row-level access, draft state, submission metadata) clearly activate the skill

### Refactor

- [x] 2.4 Review implementation and refactor as needed

## 3. Verify Definition of Done
<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 (No new tests — verification step only)

### Green

- [x] 3.2 Run `pnpm test` and confirm all suites pass
- [x] 3.3 Run `pnpm lint` (typecheck) and confirm zero errors
- [x] 3.4 Run `pnpm format` and confirm the working tree stays clean

### Refactor

- [x] 3.5 Review implementation and refactor as needed
