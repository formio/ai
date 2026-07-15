## ADDED Requirements

### Requirement: Skill MUST exist at plugin/skills/formio-sdk/

The repository SHALL contain a Claude skill at `plugin/skills/formio-sdk/SKILL.md` whose frontmatter declares it as an activatable skill named `formio-sdk`.

#### Scenario: SKILL.md present and well-formed

- **WHEN** the validator scans `plugin/skills/`
- **THEN** `plugin/skills/formio-sdk/SKILL.md` SHALL exist
- **AND** its YAML frontmatter SHALL include `name: formio-sdk`
- **AND** its YAML frontmatter SHALL include a non-empty `description` field

#### Scenario: SKILL.md missing fails validation

- **WHEN** `plugin/skills/formio-sdk/SKILL.md` is absent
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.skill_missing` issue

### Requirement: SKILL.md description MUST use the three-clause template

The `description` field of `plugin/skills/formio-sdk/SKILL.md` SHALL contain three clauses:

1. A capability statement naming `@formio/js` and `@formio/js/utils` and asserting the skill is source-derived from the Form.io source code.
2. A trigger clause beginning with the substring `Use when the user asks to`.
3. A negative-trigger clause beginning with the substring `Not for:` that names `formio-api`, `formio-application`, `formio-resource-planner`, `formio-angular`, and `formio-form` — with `formio-form` cited for task-oriented "embed/render a form in my page or app" requests (`formio-sdk` remains the raw SDK/Utils API reference).

#### Scenario: Missing trigger clause fails

- **WHEN** the description lacks `Use when the user asks to`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "trigger"`

#### Scenario: Missing negative-trigger clause fails

- **WHEN** the description lacks `Not for:`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "negative"`

#### Scenario: Negative clause omits a sibling skill name fails

- **WHEN** the `Not for:` clause is missing the literal `formio-api`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.description_clause` issue with `clause: "negative"` naming the missing sibling

#### Scenario: Negative clause routes embed tasks to formio-form

- **WHEN** the `formio-sdk` `SKILL.md` frontmatter is inspected
- **THEN** its `Not for:` clause contains the literal substring `formio-form`
- **AND** a user request like "embed this form in my web page" activates `formio-form`, not `formio-sdk`

### Requirement: Canonical imports MUST be the only documented imports

Across `plugin/skills/formio-sdk/SKILL.md` and every `plugin/skills/formio-sdk/references/*.md`, the following SHALL hold for every fenced JavaScript/TypeScript code block that imports the SDK or Utils:

- SDK imports SHALL use exactly `import { Formio } from '@formio/js';`
- Utils imports SHALL use exactly `import { Utils } from '@formio/js/utils';`

The following SHALL NOT appear in any fenced code block:

- `from '@formio/core'` (any quote style)
- `from '@formio/js/lib/` (deep import)
- `require('@formio/js')` or `require('@formio/js/utils')`

`SKILL.md` SHALL contain at least one occurrence of each canonical import line.

#### Scenario: Forbidden @formio/core import fails

- **WHEN** any reference doc contains `import { Formio } from '@formio/core'`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_import` issue with `import_path: "@formio/core"`

#### Scenario: Deep import fails

- **WHEN** any reference doc contains `import { Formio } from '@formio/js/lib/Formio'`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_import` issue with `import_path: "@formio/js/lib/Formio"`

#### Scenario: SKILL.md missing canonical SDK import fails

- **WHEN** `SKILL.md` does not contain `import { Formio } from '@formio/js'`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.canonical_import_missing` issue with `which: "sdk"`

#### Scenario: SKILL.md missing canonical Utils import fails

- **WHEN** `SKILL.md` does not contain `import { Utils } from '@formio/js/utils'`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.canonical_import_missing` issue with `which: "utils"`

### Requirement: SKILL.md MUST document Hosted and SaaS URL configuration

`plugin/skills/formio-sdk/SKILL.md` SHALL contain two distinct URL configuration blocks, each as fenced code:

- A Hosted block that calls both `Formio.setBaseUrl('https://forms.mysite.com')` and `Formio.setProjectUrl('https://forms.mysite.com/myproject')`.
- A SaaS block that calls both `Formio.setBaseUrl('https://api.form.io')` and `Formio.setProjectUrl('https://myproject.form.io')`.

#### Scenario: Hosted URL block missing fails

- **WHEN** `SKILL.md` lacks the literal substring `setBaseUrl('https://forms.mysite.com')`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.url_config_missing` issue with `environment: "hosted"`

#### Scenario: SaaS URL block missing fails

- **WHEN** `SKILL.md` lacks the literal substring `setProjectUrl('https://myproject.form.io')`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.url_config_missing` issue with `environment: "saas"`

### Requirement: Required reference documents MUST exist and be non-empty

`plugin/skills/formio-sdk/references/` SHALL contain at minimum these files, each non-empty:

- `setup.md`
- `auth.md`
- `forms.md`
- `submissions.md`
- `projects.md`
- `roles.md`
- `files.md`
- `plugins.md`
- `rendering.md`
- `utils-evaluator.md`
- `utils-form-traversal.md`
- `utils-conditions.md`
- `utils-logic.md`
- `utils-jsonlogic.md`
- `utils-mask-sanitize.md`
- `utils-misc.md`

#### Scenario: Required reference missing fails

- **WHEN** any of the required reference files is absent or zero bytes
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.reference_missing` issue naming the file

### Requirement: Reference documents MUST follow the required heading layout

Every file under `plugin/skills/formio-sdk/references/` SHALL contain these top-level Markdown headings in this exact order:

1. `## Overview`
2. `## Imports`
3. `## URL Configuration` (REQUIRED for SDK references; OPTIONAL for `utils-*` references that perform no HTTP)
4. `## API`
5. `## Examples`
6. `## MCP Tool Preference` (REQUIRED when an MCP tool overlaps; otherwise OPTIONAL)

Headings not listed above MAY appear, but the required headings SHALL appear in the listed order whenever present.

#### Scenario: Reference missing Overview fails

- **WHEN** a reference doc lacks `## Overview`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.reference_layout` issue with `rule: "missing"` naming the heading

#### Scenario: Reference with Examples before API fails

- **WHEN** `## Examples` appears before `## API` in a reference doc
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.reference_layout` issue with `rule: "order"`

### Requirement: SDK reference URL Configuration sections MUST show both Hosted and SaaS

Every reference doc whose layout includes `## URL Configuration` SHALL show both a Hosted and a SaaS example, matching the same URL literals required of `SKILL.md`.

#### Scenario: SDK reference URL Configuration missing SaaS example fails

- **WHEN** `references/forms.md`'s `## URL Configuration` section lacks `setProjectUrl('https://myproject.form.io')`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.url_config_missing` issue with `environment: "saas"` naming the reference file

### Requirement: Each reference MUST cite its source path in Overview

The `## Overview` section of every reference doc SHALL contain the literal substring `Sourced from ` followed by a backticked path beginning with `packages/core/` or `packages/formio.js/`.

#### Scenario: Reference Overview missing source attribution fails

- **WHEN** a reference's `## Overview` section lacks any `Sourced from \`packages/` string
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.reference_layout` issue with `rule: "missing_source_attribution"` naming the reference file

### Requirement: SKILL.md MUST include a navigation table mapping intent to reference

`plugin/skills/formio-sdk/SKILL.md` SHALL contain a Markdown table whose header row includes both `Intent` and `Reference` (case-sensitive), and whose body links to each required reference file under `references/`.

#### Scenario: Navigation table missing fails

- **WHEN** `SKILL.md` contains no Markdown table with `Intent` and `Reference` columns
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.navigation_table_missing` issue

#### Scenario: Navigation table omits a required reference fails

- **WHEN** the navigation table lacks a link to `references/utils-jsonlogic.md`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.navigation_table_missing` issue naming the unlinked reference

### Requirement: rendering.md MUST teach Formio.createForm via ESM imports only

`plugin/skills/formio-sdk/references/rendering.md` SHALL contain at minimum:

- The canonical import line `import { Formio } from '@formio/js';` inside a fenced code block.
- At least one fenced example that calls `Formio.createForm(` with an `HTMLElement` target and a form source argument.
- An `## Examples` section demonstrating, at minimum, event subscription via `form.on('submit', ...)` and prefill via the `submission` property on the resolved form instance.

`rendering.md` SHALL NOT contain any `<script ` tag inside any fenced code block — the renderer is loaded only via ESM `import` statements.

#### Scenario: rendering.md missing the createForm example fails

- **WHEN** `references/rendering.md` exists but contains no fenced block matching `Formio.createForm(`
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.rendering_entry_missing` issue

#### Scenario: rendering.md uses a script tag fails

- **WHEN** `references/rendering.md` contains a fenced code block with `<script ` referencing the Form.io renderer
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_script_tag` issue

### Requirement: Forbidden script-tag rule applies library-wide for the formio-sdk skill

No fenced code block under `plugin/skills/formio-sdk/SKILL.md` or `plugin/skills/formio-sdk/references/*.md` SHALL contain a `<script ` tag that loads the Form.io renderer (whether via `src="https://cdn.form.io"`, `src="https://unpkg.com/@formio/js"`, or any similar CDN URL). The renderer is always loaded via the canonical ESM import.

#### Scenario: SKILL.md contains a renderer script tag

- **WHEN** `SKILL.md` contains `<script src="https://cdn.form.io/...formio.full.min.js"></script>` inside a fenced block
- **THEN** `validateFormioSdkSkill` SHALL emit a `formio_sdk.forbidden_script_tag` issue
