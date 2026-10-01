## MODIFIED Requirements

### Requirement: formio-form-builder description uses the three-clause template and states the form-vs-resource boundary

The `formio-form-builder` `SKILL.md` frontmatter `description` SHALL contain three clauses:

1. A capability statement: an orchestrator that builds a single Form.io form end to end — determines the form type (webform or wizard), delegates schema authoring, saves the form into the user's Form.io project via the MCP server, and optionally hands off to embedding.
2. A trigger clause beginning with the substring `Use when the user asks to` claiming single-form creation intents. Example triggers the description MUST claim include: "build a form", "create a form", "I would like a new form", "multi-page form", "build a wizard", "create a survey", "contact form", "intake form", "registration form", "questionnaire". The trigger clause SHALL NOT claim PDF-document phrasing ("pdf form", "turn this PDF into a form"), which belongs to `formio-pdf-form`.
3. A negative-trigger clause beginning with the substring `Not for:` that names ALL of: `formio-form` (embedding an EXISTING form), `formio-pdf-form` (PDF-based forms), `formio-application` (building a whole app, portal, or tracker), `formio-resource-planner` (designing resources, data models, or permissions), `formio-schema` (raw form JSON schema lookups without the build-and-save flow), and `formio-api` (Form.io REST endpoint lookups).

The description SHALL additionally state the form-vs-resource boundary rule explicitly: "build a form to collect X" (a standalone form) belongs to this skill, while "track X / manage X / build an app around X" (a data model, CRUD, resources) belongs to `formio-application` / `formio-resource-planner`.

#### Scenario: formio-form-builder claims single-form creation phrasing

- **WHEN** the user says "build me a form to collect customer feedback" or "create a multi-page registration wizard"
- **THEN** the `formio-form-builder` skill activates
- **AND** neither `formio-application` nor `formio-resource-planner` activates

#### Scenario: App and data-model phrasing does NOT route through formio-form-builder

- **WHEN** the user says "build me an app to track maintenance requests" or "model customers and orders"
- **THEN** `formio-application` (or `formio-resource-planner`) activates
- **AND** `formio-form-builder` does not activate

#### Scenario: PDF-document phrasing does NOT route through formio-form-builder

- **WHEN** the user says "turn this PDF into a fillable form"
- **THEN** `formio-pdf-form` activates
- **AND** `formio-form-builder` does not activate

#### Scenario: Negative clause names every sibling

- **WHEN** the `formio-form-builder` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause containing the backtick-delimited names `` `formio-form` ``, `` `formio-pdf-form` ``, `` `formio-application` ``, `` `formio-resource-planner` ``, `` `formio-schema` ``, and `` `formio-api` ``

#### Scenario: Boundary rule stated verbatim

- **WHEN** the `formio-form-builder` `SKILL.md` frontmatter is inspected
- **THEN** its `description` states that standalone form-collection requests belong to this skill and data-model / app-around-data requests belong to `formio-application` / `formio-resource-planner`

### Requirement: FORM_TYPES.md documents the three form types from the official docs

`FORM_TYPES.md` SHALL document, for each of the three Form.io form types — webform (single-page form), wizard (multi-page form), and PDF form — what it is, what it can do, when to choose it, and the phrasing signals the INTENT step uses to distinguish them. The wizard section SHALL cover nested wizard workflows (child wizards for complex multi-page flows). The PDF form section SHALL state that a PDF form renders over an uploaded PDF document, SHALL list the overlay component types exactly as the PDF builder allows them (no `radio`), SHALL NOT state that non-standard page sizes fail (a 433×287 pt page uploads, converts, and renders on a current deployment), and SHALL state that the `formio-pdf-form` skill performs the upload, the conversion review, and the save — referencing it by name rather than describing that pipeline. The webform section SHALL note that a webform's submission PDF can be laid out with a PDF template, owned by `formio-pdf-form`. Content SHALL be authored from the official help.form.io documentation (form types, PDF forms, nested wizard workflow) and checked against the Form.io source.

#### Scenario: All three form types covered

- **WHEN** `FORM_TYPES.md` is inspected
- **THEN** webform, wizard, and PDF form are each documented with capabilities, when-to-choose guidance, and INTENT distinguishing signals

#### Scenario: Nested wizards covered

- **WHEN** `FORM_TYPES.md` is inspected
- **THEN** the wizard section documents nested/child wizard workflows

#### Scenario: PDF section points at the PDF skill

- **WHEN** the PDF form section of `FORM_TYPES.md` is inspected
- **THEN** it contains the literal substring `formio-pdf-form`
- **AND** it does not list `radio` as an overlay component

## ADDED Requirements

### Requirement: INTENT's pdf answer hands off to formio-pdf-form

When the INTENT interview confirms the PDF form type, the flow SHALL hand off to `formio-pdf-form`'s build lane instead of running SCHEMA and SAVE, passing the captured title (when given) and the embed answer. `INTENT.md` SHALL state this handoff by skill name and SHALL NOT describe the PDF pipeline itself. When the user describes a webform whose submissions must download as a laid-out document, the flow SHALL build the webform through the normal steps and then offer `formio-pdf-form`'s PDF template lane.

#### Scenario: pdf answer hands off

- **WHEN** the user confirms the PDF form type at INTENT
- **THEN** the flow continues in `formio-pdf-form` with the embed answer carried over
- **AND** `formio-form-builder` makes no `form_create` call for that form

#### Scenario: Webform with designed PDF output

- **WHEN** the user asks for "an order form whose submissions print as a one-page receipt"
- **THEN** the webform is built and saved through the normal steps
- **AND** the flow offers `formio-pdf-form`'s PDF template lane afterward
