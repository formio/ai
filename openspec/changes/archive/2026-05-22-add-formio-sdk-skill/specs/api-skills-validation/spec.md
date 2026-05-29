## ADDED Requirements

### Requirement: Validator MUST run formio-sdk skill checks when the skill exists

`validateLibrary(libraryDir)` SHALL invoke `validateFormioSdkSkill(libraryDir)` whenever `plugin/skills/formio-sdk/` exists in the library directory. The function SHALL be exported from `packages/mcp-server/src/skills-validator.ts` so Vitest can target it directly.

`validateFormioSdkSkill` SHALL emit issues using the existing `<category>.<rule>` shape with `category: "formio_sdk"`. Recognized rules are:

- `formio_sdk.skill_missing`
- `formio_sdk.frontmatter_missing`
- `formio_sdk.description_clause` (with `clause: "capability" | "trigger" | "negative"`)
- `formio_sdk.canonical_import_missing` (with `which: "sdk" | "utils"`)
- `formio_sdk.forbidden_import` (with `import_path: string`)
- `formio_sdk.url_config_missing` (with `environment: "hosted" | "saas"`)
- `formio_sdk.reference_missing` (with `file: string`)
- `formio_sdk.reference_layout` (with `rule: "missing" | "order" | "missing_source_attribution"`)
- `formio_sdk.navigation_table_missing`

If `plugin/skills/formio-sdk/` is absent, `validateFormioSdkSkill` SHALL emit no issues so existing skill libraries continue to validate cleanly.

#### Scenario: Validator runs against the formio-sdk skill under pnpm test

- **WHEN** `pnpm test` executes and `plugin/skills/formio-sdk/` exists
- **THEN** `validateLibrary` SHALL include the results of `validateFormioSdkSkill`
- **AND** any reported issue SHALL cause the Vitest run to fail

#### Scenario: Validator no-ops when the skill is absent

- **WHEN** `pnpm test` executes and `plugin/skills/formio-sdk/` does not exist
- **THEN** `validateFormioSdkSkill` SHALL return zero issues
- **AND** the test run SHALL not fail on account of the missing skill

### Requirement: Forbidden-imports rule MUST cover @formio/core and @formio/js deep imports under formio-sdk

The validator SHALL emit a `formio_sdk.forbidden_import` issue when any fenced code block under `plugin/skills/formio-sdk/` contains:

- `from '@formio/core'` (in any quote style)
- `from '@formio/js/lib/` (deep import)
- `require('@formio/js')` or `require('@formio/js/utils')`

Forbidden-import detection SHALL ignore non-import occurrences (prose mentioning `@formio/core` in plain text outside fenced code) so the skill can still discuss internal package structure.

#### Scenario: Prose mention of @formio/core does not fire

- **WHEN** `SKILL.md` body contains the sentence `The renderer extends @formio/core's SDK.` outside any code fence
- **THEN** `validateFormioSdkSkill` SHALL NOT emit a `formio_sdk.forbidden_import` issue for that occurrence

#### Scenario: require() of @formio/js inside a fenced block fails

- **WHEN** a fenced JavaScript block contains `const { Formio } = require('@formio/js');`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_import` issue with `import_path: "@formio/js"`
