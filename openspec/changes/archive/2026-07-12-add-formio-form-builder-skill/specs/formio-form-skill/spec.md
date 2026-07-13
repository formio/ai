## MODIFIED Requirements

### Requirement: formio-form description uses the three-clause template and claims framework-agnostic embed triggers

The `formio-form` `SKILL.md` frontmatter `description` SHALL contain three clauses:

1. A capability statement naming the Vanilla JS renderer `@formio/js` and asserting the skill covers embedding forms in any web application — rendering by URL or JSON, submission pre-fill, JavaScript control, renderer options, conditional logic, calculated values, and JSON Logic validation.
2. A trigger clause beginning with the substring `Use when the user asks to` claiming framework-agnostic embed phrasing. Example triggers the description MUST claim include: "embed a form", "render a form", "add this form to my page/site/app", "pre-fill a form", "show or hide a field based on another field", "calculate a field value", "add custom validation to a field", "conditional wizard".
3. A negative-trigger clause beginning with the substring `Not for:` that names ALL of: `formio-angular` (user explicitly names Angular or `@formio/angular`), `formio-application` (building a whole app, portal, or tracker around data), `formio-resource-planner` (designing the data model), `formio-api` (REST endpoint lookups), `formio-sdk` (raw SDK/Utils API reference beyond embedding), and `formio-form-builder` (creating a NEW form — `formio-form` stays embed-only).

#### Scenario: formio-form claims framework-agnostic embed phrasing

- **WHEN** the user says "embed this form in my web page" or "make the model field depend on the make field" with no framework named
- **THEN** the `formio-form` skill activates
- **AND** neither `formio-angular` nor `formio-application` activates

#### Scenario: Angular-explicit phrasing does NOT route through formio-form

- **WHEN** the user says "embed this form in my Angular app" or names `@formio/angular`
- **THEN** `formio-angular` activates
- **AND** `formio-form` does not activate

#### Scenario: Create-a-new-form phrasing does NOT route through formio-form

- **WHEN** the user says "build a form" or "create a new survey" (no existing form to embed)
- **THEN** `formio-form-builder` activates
- **AND** `formio-form` does not activate

#### Scenario: Negative clause names every sibling

- **WHEN** the `formio-form` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause containing the literal substrings `formio-angular`, `formio-application`, `formio-resource-planner`, `formio-api`, `formio-sdk`, and the backtick-delimited `` `formio-form-builder` ``

## ADDED Requirements

### Requirement: formio-form routes not-yet-existing forms to formio-form-builder

When an embed request reveals that the form to embed does not exist yet in the user's Form.io project, or the user describes a complex form needing form-type determination (webform vs wizard vs PDF form) before any embedding can happen, the `formio-form` skill SHALL route to the `formio-form-builder` skill to create the form first. After `formio-form-builder` saves the form, embedding proceeds via its EMBED handoff back to `formio-form`.

#### Scenario: Embed request for a nonexistent form

- **WHEN** `formio-form` is active and the form the user wants to embed does not exist in the project
- **THEN** `formio-form` routes to `formio-form-builder` to create and save the form
- **AND** embedding resumes with the saved form URL

#### Scenario: Complex form described inside an embed request

- **WHEN** the user asks to embed a form they describe from scratch (e.g., "embed a multi-step intake wizard on my page" with no existing form)
- **THEN** `formio-form` routes to `formio-form-builder` for form-type determination and creation before any embedding
