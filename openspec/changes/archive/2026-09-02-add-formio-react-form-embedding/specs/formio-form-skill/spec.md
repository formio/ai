## ADDED Requirements

### Requirement: formio-form checks the host before writing mounting code

`formio-form` documents the Vanilla JS renderer, and its mounting guidance — `Formio.createForm(element, srcOrJson, options)` against a DOM element — is the wrong shape inside a component framework that ships its own renderer wrapper. An explicitly framework-named request never reaches this skill, because description matching routes it to the framework skill. The request that does reach it is the one that names no framework: "embed this form in my app", issued from inside a React workspace.

Before writing mounting code, `formio-form` SHALL therefore determine the host application. When the working directory is a React application — `react` in `package.json` dependencies — it SHALL hand off to `formio-react`'s embed branch rather than emitting `Formio.createForm` guidance, saying in one line why. This SHALL be a single step, not a framework dispatch table with per-framework branch documents; the routing table lives in the framework skills' own descriptions.

This check applies ONLY to the mounting half. A question about a form definition — a conditional, a calculated value, a validation rule, a cascading select, wizard page logic — SHALL be answered here regardless of host, because the answer is identical in every framework.

When the host is Angular, `formio-form` SHALL note that `@formio/angular` ships its own renderer component and that a dedicated Angular embedding skill does not exist yet, then continue with the Vanilla JS guidance, which does work inside an Angular application. It SHALL NOT claim the Vanilla JS path is the recommended Angular approach.

The check SHALL be cheap and SHALL NOT become an interview: when the host is not detectable from the workspace, `formio-form` proceeds with its own guidance rather than asking.

#### Scenario: Unqualified embed request in a React workspace hands off

- **WHEN** the user says "embed this form in my app" and `package.json` lists `react`
- **THEN** `formio-form` hands off to `formio-react`'s embed branch
- **AND** it states in one line why it routed there
- **AND** it does not emit `Formio.createForm` mounting guidance

#### Scenario: Plain page keeps the Vanilla JS path

- **WHEN** the workspace is not a component-framework application
- **THEN** `formio-form` proceeds with its own mounting guidance and hands off to nothing

#### Scenario: Field-behavior questions are answered here whatever the host

- **WHEN** the user asks how to hide one field based on another, from inside a React workspace
- **THEN** `formio-form` answers from its conditionals reference
- **AND** it does not hand off

#### Scenario: Angular host is told the truth

- **WHEN** the workspace is an Angular application and the request names no framework
- **THEN** `formio-form` notes that `@formio/angular` ships its own renderer component and that no Angular embedding skill exists yet
- **AND** it continues with the Vanilla JS guidance without presenting it as the recommended Angular approach

#### Scenario: Undetectable host does not trigger an interview

- **WHEN** the host cannot be determined from the workspace
- **THEN** `formio-form` proceeds with its own guidance without asking the user

### Requirement: formio-form owns definition-level behavior for every framework

`formio-form` SHALL remain the single home for behavior that lives in the form definition rather than in the host: conditionals, `calculateValue`, `validate.json`, component `logic` arrays, external data sources and cascading selects, wizard page logic, and the JSON Logic primer.

Framework embedding skills SHALL link to these references rather than restating them. A framework skill that duplicates this content creates a second copy that drifts from the first, and the content does not vary by framework — the definition is evaluated by the same renderer core whatever mounts it.

#### Scenario: Framework skills carry no duplicate behavior content

- **WHEN** any framework embedding skill's references are inspected
- **THEN** none documents `calculateValue`, `validate.json`, component `logic`, conditional syntax, cascading selects, or the JSON Logic primer
- **AND** each links to the corresponding `formio-form` reference

## MODIFIED Requirements

### Requirement: formio-form description uses the three-clause template and claims framework-agnostic embed triggers

The `formio-form` `SKILL.md` frontmatter `description` SHALL contain three clauses:

1. A capability statement naming the Vanilla JS renderer `@formio/js` and asserting the skill covers embedding forms in any web application — rendering by URL or JSON, submission pre-fill, JavaScript control, renderer options, conditional logic, calculated values, and JSON Logic validation.
2. A trigger clause beginning with the substring `Use when the user asks to` claiming framework-agnostic embed phrasing. Example triggers the description MUST claim include: "embed a form", "render a form", "add this form to my page/site/app", "pre-fill a form", "show or hide a field based on another field", "calculate a field value", "add custom validation to a field", "conditional wizard".
3. A negative-trigger clause beginning with the substring `Not for:` that names ALL of: `formio-angular` (user explicitly names Angular or `@formio/angular`), `formio-react` (user explicitly names React or `@formio/react`), `formio-application` (building a whole app, portal, or tracker around data), `formio-resource-planner` (designing the data model), `formio-api` (REST endpoint lookups), `formio-sdk` (raw SDK/Utils API reference beyond embedding), and `formio-form-builder` (creating a NEW form — `formio-form` stays embed-only).

The trigger clause SHALL keep its framework-agnostic phrasing. This skill remains the entry point for an embed request that names no framework; what changed is that it checks the host before writing mounting code, per the host-check requirement.

#### Scenario: formio-form claims framework-agnostic embed phrasing

- **WHEN** the user says "embed this form in my web page" or "make the model field depend on the make field" with no framework named
- **THEN** the `formio-form` skill activates
- **AND** neither `formio-angular` nor `formio-application` activates

#### Scenario: Angular-explicit phrasing does NOT route through formio-form

- **WHEN** the user says "embed this form in my Angular app" or names `@formio/angular`
- **THEN** `formio-angular` activates
- **AND** `formio-form` does not activate

#### Scenario: React-explicit phrasing does NOT route through formio-form

- **WHEN** the user says "embed this form in my React app" or names `@formio/react`
- **THEN** `formio-react` activates and dispatches to its embed branch
- **AND** `formio-form` does not activate

#### Scenario: Create-a-new-form phrasing does NOT route through formio-form

- **WHEN** the user says "build a form" or "create a new survey" (no existing form to embed)
- **THEN** `formio-form-builder` activates
- **AND** `formio-form` does not activate

#### Scenario: Negative clause names every sibling

- **WHEN** the `formio-form` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains a `Not for:` clause containing the literal substrings `formio-angular`, `formio-react`, `formio-application`, `formio-resource-planner`, `formio-api`, `formio-sdk`, and the backtick-delimited `` `formio-form-builder` ``
