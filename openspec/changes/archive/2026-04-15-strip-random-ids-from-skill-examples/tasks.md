## 1. Validator rule: forbid random-id suffixes in example values
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: a skill body containing `"title": "Employee 775"` makes `validateNoRandomIdSuffixes` emit a `content.random_id_suffix` issue
- [x] 1.2 Write failing test: a skill body containing `"name": "employee-510"` emits `content.random_id_suffix`
- [x] 1.3 Write failing test: a skill body containing `"path": "user/login-374"` emits `content.random_id_suffix`
- [x] 1.4 Write failing test: a skill body containing `"machineName": "example-906:example-771:save"` emits `content.random_id_suffix`
- [x] 1.5 Write failing test: clean identifier values (`"title": "Employee"`, `"name": "employee"`, `"path": "user/login"`, `"machineName": "example:example:save"`) produce no issues
- [x] 1.6 Write failing test: a MongoDB ObjectId in a URL path (`"path": "/form/64d7b40e81d6ad28758b767e/submission"`) produces no issues
- [x] 1.7 Write failing test: a PDF overlay key (`"key": "f1010"`) and a positional PDF field key (`"key": "f1_01[0]"`) produce no issues

### Green

- [x] 1.8 Implement `validateNoRandomIdSuffixes(file, body)` in `packages/mcp-server/src/skills-validator.ts` using the slug-form and title-form regexes from design.md
- [x] 1.9 Compose `validateNoRandomIdSuffixes` into `validateSkillContent` so the rule runs against every capability-group `SKILL.md`
- [x] 1.10 Export the new function and its issue rule name from `skills-validator.ts` for test imports

### Refactor

- [x] 1.11 Review implementation and refactor as needed

## 2. Content cleanup: strip suffixes from every affected skill
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `validateLibrary(path.join(repoRoot, '.claude/skills'))` returns no `content.random_id_suffix` issue against the actual checked-in library

### Green

- [x] 2.2 Sweep every `.claude/skills/formio-api-*/SKILL.md` for matches of the title-form regex and strip the ` \d{2,}` suffix from each matching `title` value
- [x] 2.3 Sweep every `.claude/skills/formio-api-*/SKILL.md` for matches of the slug-form regex and strip the `-\d{2,}` suffix from each `-`, `/`, or `:`-delimited segment of `name`, `path`, `key`, and `machineName` values
- [x] 2.4 Confirm affected files include at minimum `formio-api/references/pdf-api`, `formio-api/references/project-actions`, `formio-api/references/project-form-revisions`, `formio-api/references/project-roles`, `formio-api/references/runtime-access-control`, `formio-api/references/runtime-custom-users`, and any others the validator surfaces during the sweep

### Refactor

- [x] 2.5 Review implementation and refactor as needed
