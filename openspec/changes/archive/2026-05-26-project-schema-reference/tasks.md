## 1. Author project reference files
<!-- depends_on: none -->

### Red

- [x] 1.1 Update `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts`: remove the `PLACEHOLDER_DOMAINS` constant (no placeholders remain), delete the `it('each placeholder domain README states not-yet-authored…')` test, and delete the `it('body references each references/<domain>/README.md placeholder')` test. These removals SHOULD remain green after the change — they only change in lock-step with the project-domain promotion
- [x] 1.2 Add a new `describe('formio-schema project-domain references', …)` block asserting `plugin/skills/formio-schema/references/project/` contains exactly `project-definition.md`, `project-type-and-framework.md`, `project-settings.md`, `project-access.md`, that none of them carry YAML frontmatter, that `project/README.md` does not exist, and that `project/project-billing-and-usage.md` does not exist either — these assertions should fail against the current placeholder layout
- [x] 1.3 Extend the new project `describe` block with body assertions: `project-definition.md` mentions every Project property name (`_id`, `title`, `name`, `type`, `description`, `tag`, `owner`, `externalOwner`, `project`, `remote`, `plan`, `billing`, `apiCalls`, `steps`, `framework`, `primary`, `access`, `trial`, `lastDeploy`, `stageTitle`, `machineName`, `config`, `protect`, `settings`, `remoteSecret`, `builderConfig`, `formDefaults`, `public`, `created`, `modified`, `deleted`) AND mentions the string `commercial` (for the "deployed projects always have plan `'commercial'`" note); `project-type-and-framework.md` mentions every ProjectType (`project`, `stage`, `tenant`) and every ProjectFramework value (`angular`, `angular2`, `react`, `vue`, `html5`, `simple`, `custom`, `aurelia`, `javascript`) — NO ProjectPlan enumeration — AND contains the literal strings `"type": "stage"` and `"type": "tenant"`, AND states that a Stage's `project` field holds the parent project's ObjectId (typically the portal/primary project); `project-settings.md` mentions every documented ProjectSettings key (`appOrigin`, `keys`, `cors`, `csp`, `secret`, `pdfserver`, `filetoken`, `allowConfig`, `allowConfigToForms`, `custom`, `formModule`, `email`, `captcha`, `recaptcha`, `esign`, `google`, `kickbox`, `sqlconnector`, `storage`, `tokenParse`, `oauth`, `ldap`, `saml`) and the word `encrypted`; `project-access.md` mentions `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo`, plus distinguishes project-level from form-level and submission-level access. No ProjectUsage counter assertions — usage stats are out of scope

### Green

- [x] 1.4 Delete `plugin/skills/formio-schema/references/project/README.md`
- [x] 1.5 Author `project-definition.md`
- [x] 1.6 Author `project-type-and-framework.md` with Stage + Tenant patterns
- [x] 1.7 Author `project-settings.md` with encryption-at-rest callout
- [x] 1.8 Author `project-access.md` with project/form/submission layer comparison

### Refactor

- [x] 1.9 Review implementation and refactor as needed

## 2. Update router SKILL.md to index the project domain
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Extend the layout test's existing "body indexes every domain" `describe` block: add an assertion that the router body references all four `references/project/project-*.md` paths, an assertion that the router body does NOT reference `references/project/README.md`, an assertion that the router body does NOT reference `references/project/project-billing-and-usage.md`

### Green

- [x] 2.2 Edit `plugin/skills/formio-schema/SKILL.md`: replace the "Projects" placeholder subsection with a "Projects" subsection containing a multi-row table listing every project reference (path + one-line "Working on…" cue); update the trigger clause so project-specific phrases (project settings, stages, tenants, OAuth/LDAP/SAML, file storage, project plan, project access, billing) clearly activate the skill

### Refactor

- [x] 2.3 Review implementation and refactor as needed

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
