## Purpose

Defines the automated validation suite for the API and SDK skill libraries: the section layout every reference must have, the canonical auth paragraph, forbidden legacy-auth tokens and deep imports, resolved Postman placeholders, PDF scope, URL terminology, and example-value rules.

## Requirements

### Requirement: Validation suite runs under pnpm test

The repository SHALL include a Vitest validation suite that invokes `validateLibrary(libraryDir)` against `plugin/skills/` and fails the test run if any issue is reported. It SHALL live in `@formio/skill-tests` — the package that exists to test the skills library — at `packages/skill-tests/src/library-validation/validate-library.ts`, with its suite beside it. It SHALL NOT live in `packages/mcp-server`: a validator for the skills library kept in the server package is superfluous to that package by construction, which is how the previous implementation came to be deleted while this capability went on specifying it, leaving every rule below as prose nothing ran for four months.

#### Scenario: Validation runs under pnpm test

- **WHEN** a developer runs `pnpm test`
- **THEN** the skills-library validation suite executes
- **AND** any issue reported by `validateLibrary` causes the test run to fail

### Requirement: Reference docs MUST have the required section layout

Every file under `plugin/skills/formio-api/references/` SHALL contain these top-level Markdown headings, in this exact order:

1. `## Overview`
2. `## Root URL`
3. `## Authentication`
4. `## MCP Tool Preference`
5. `## Endpoints`

Absence or misordering of any required heading SHALL fail validation.

#### Scenario: Reference missing a required heading fails

- **WHEN** a reference doc omits `## MCP Tool Preference`
- **THEN** `validateReferenceContent` SHALL emit a `headings.missing` issue naming the missing heading

#### Scenario: Reference with out-of-order headings fails

- **WHEN** `## Endpoints` appears before `## Authentication` in a reference doc
- **THEN** `validateReferenceContent` SHALL emit a `headings.order` issue

### Requirement: Authenticated references MUST contain the canonical auth paragraph

Every reference EXCEPT `server-status.md` SHALL contain the canonical authentication paragraph verbatim in its `## Authentication` section. The paragraph is exposed as the exported constant `CANONICAL_AUTH_PARAGRAPH`.

`server-status.md` is exempt because its endpoints are unauthenticated.

#### Scenario: Reference lacking the canonical auth paragraph fails

- **WHEN** a reference doc (not `server-status`) `## Authentication` section omits `CANONICAL_AUTH_PARAGRAPH`
- **THEN** `validateReferenceContent` SHALL emit an `auth.canonical_paragraph` issue

### Requirement: References MUST NOT contain legacy-auth tokens

Every reference SHALL NOT contain the literal strings `x-token` or `FORMIO_API_KEY`, nor the case-insensitive phrase `api key`. Portal-login JWT is the only supported authentication mechanism for documented endpoints.

#### Scenario: Forbidden legacy-auth token fails

- **WHEN** a reference body contains `x-token`
- **THEN** `validateForbiddenTokens` SHALL emit a `forbidden.legacy_auth` issue

### Requirement: Postman placeholders MUST be resolved

Reference docs SHALL resolve Postman collection placeholders to substitution slots:

- `{{baseUrl}}/{{projectName}}` SHALL become `{projectUrl}` in project-, runtime-, and pdf-scope references.
- Bare `{{baseUrl}}/` (not followed by `{{projectName}}`) SHALL become `{baseUrl}` in platform-scope references.

The resolved form SHALL NOT carry an environment-variable name. A slot in an endpoint heading is a value the reader substitutes, and spelling it `${FORMIO_PROJECT_URL}` instructed an agent to read an environment variable in order to build a URL — a different and wrong action.

Placeholders inside fenced or inline code blocks are stripped before matching, so they do not trigger the rule.

#### Scenario: Unresolved project placeholder outside code fences fails

- **WHEN** a project-scope reference contains `{{baseUrl}}/{{projectName}}/form` as prose
- **THEN** `validateReferenceContent` SHALL emit a `placeholder.project` issue

#### Scenario: An environment-variable root fails

- **WHEN** a reference roots an endpoint at `${FORMIO_PROJECT_URL}` or `${FORMIO_BASE_URL}`
- **THEN** validation SHALL emit an issue naming the environment-variable form as non-conformant
- **AND** the fix SHALL be the `{projectUrl}` or `{baseUrl}` slot

### Requirement: PDF-scope endpoints MUST be under /pdf-proxy

Every endpoint heading (`### GET|POST|PUT|PATCH|DELETE <path>`) inside `pdf-api.md` SHALL have a path that begins with `{projectUrl}/pdf-proxy`. The "PDF server direct API" is out of scope.

#### Scenario: PDF endpoint outside /pdf-proxy fails

- **WHEN** `pdf-api.md` contains `### GET {projectUrl}/file`
- **THEN** `validatePdfProxyPath` SHALL emit a `pdf.proxy_path` issue

### Requirement: Terminology — baseUrl vs projectUrl

Reference docs SHALL NOT describe the project endpoint using `baseUrl` / `base_url`, and SHALL NOT describe the platform deployment endpoint using `projectUrl` / `project_url`. The canonical mapping is:

- `projectUrl` / `project_url` → the project endpoint, written `{projectUrl}` where it is a substitution slot
- `baseUrl` / `base_url` → the platform deployment endpoint, written `{baseUrl}` where it is a substitution slot

Validation SHALL additionally reject an `FORMIO_*` name used as a substitution slot or as the name of a value passed between phases. The environment-variable spelling is reserved for text whose subject is the environment.

#### Scenario: Misuse of baseUrl for project endpoint fails

- **WHEN** a reference contains prose `baseUrl is the project endpoint`
- **THEN** `validateTerminology` SHALL emit a `terminology.baseUrl_for_project` issue

#### Scenario: An environment-variable name used as a slot fails

- **WHEN** a reference or skill document uses `FORMIO_PROJECT_URL` as an endpoint root or as the name of a value handed between phases
- **THEN** `validateTerminology` SHALL emit an issue
- **AND** the same name in an environment table or an `env`-block warning SHALL NOT be flagged
### Requirement: Example values MUST NOT contain collision-avoidance integer suffixes

Example JSON values (`title`, `name`, `path`, `key`, `machineName`) SHALL NOT end in `-<digits>` or ` <digits>` suffixes used solely to avoid name collisions in tests. Canonical examples SHALL present clean human-authored values. The rule SHALL NOT flag MongoDB ObjectId hex strings, UUIDs, PDF overlay field keys (`f1010`, `f1_01[0]`), or single-digit numeric tokens (`email2`).

#### Scenario: Random-id suffix in example title fails

- **WHEN** an example JSON object contains `"title": "My Form 42"`
- **THEN** `validateNoRandomIdSuffixes` SHALL emit a `content.random_id_suffix` issue

### Requirement: Validator MUST run formio-sdk skill checks when the skill exists

`validateLibrary(libraryDir)` SHALL invoke `validateFormioSdkSkill(libraryDir)` whenever `plugin/skills/formio-sdk/` exists in the library directory. The function SHALL be exported from `packages/skill-tests/src/library-validation/validate-library.ts` so Vitest can target it directly.

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

- `from '@formio/js/lib/` (deep import)
- `require('@formio/js')` or `require('@formio/js/utils')`
- a default or namespace import from `@formio/core`
- a NAMED import from `@formio/core` (or a `@formio/core/*` sub-path) of anything outside the sanctioned core-only list

`@formio/core` SHALL NOT be banned outright. The skill documents a short, named set of helpers `@formio/js` does not re-export — `jsonLogic`, `dom`, `I18n`, `override`, `unwind`, `sanitize`, `logicProcessSync`, `logicProcessInfo`, `DefaultEvaluator` — and importing THOSE from core is the fallback it teaches, so a blanket ban would fail the skill for following its own guidance. What the rule forbids is reaching into core for a surface `@formio/js` already exposes, which is how a reader ends up depending on an internal package the renderer merely happens to be built on. The sanctioned list SHALL be exported so the rule and the skill cannot drift apart silently.

Forbidden-import detection SHALL ignore non-import occurrences (prose mentioning `@formio/core` in plain text outside fenced code) so the skill can still discuss internal package structure.

#### Scenario: A sanctioned core-only helper does not fire

- **WHEN** a fenced block contains `import { jsonLogic } from '@formio/core';`
- **THEN** `validateFormioSdkSkill` SHALL NOT emit a `formio_sdk.forbidden_import` issue

#### Scenario: An unsanctioned core import fires

- **WHEN** a fenced block contains `import { Formio } from '@formio/core';`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_import` issue naming `Formio`

#### Scenario: Prose mention of @formio/core does not fire

- **WHEN** `SKILL.md` body contains the sentence `The renderer extends @formio/core's SDK.` outside any code fence
- **THEN** `validateFormioSdkSkill` SHALL NOT emit a `formio_sdk.forbidden_import` issue for that occurrence

#### Scenario: require() of @formio/js inside a fenced block fails

- **WHEN** a fenced JavaScript block contains `const { Formio } = require('@formio/js');`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_import` issue with `import_path: "@formio/js"`
