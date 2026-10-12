# tool-description-budget Specification

## Purpose

Defines the measured size budget for `tools/list` and which descriptions a tool, argument, or output field keeps.

## Requirements

### Requirement: The tool list fits a measured budget

The serialized `tools/list` result SHALL NOT exceed 42,000 characters, and a test SHALL measure it. The `cwd` argument description SHALL NOT exceed 100 characters, and SHALL state that the argument is optional and that it defaults to the client's workspace root; when to pass it, and the order a directory is chosen in, SHALL be stated in the server instructions, which every client receives once. A tool description SHALL carry what a caller acts on — when to use the tool, what it requires, what it returns, and the refusals it can raise — and SHALL NOT carry change history or design rationale, which belong in the README or code comments.

#### Scenario: The budget is enforced

- **WHEN** the test suite lists every registered tool
- **THEN** the serialized result is at most 42,000 characters

#### Scenario: The cwd description is short

- **WHEN** any tool's `cwd` argument is inspected
- **THEN** its description is at most 100 characters, says the argument is optional, and says it defaults to the client's workspace root

#### Scenario: The full cwd rules stay in the server instructions

- **WHEN** the server instructions are read
- **THEN** they state the order a directory is chosen in and that a caller passes `cwd` when `project_get` reports `cwdSource` `"server"` or `"claude-project-dir"`, or to target another directory

### Requirement: Descriptions sit where a caller acts on them

An output schema SHALL describe only the fields a caller branches on — `project_set`'s `ok`, `status`, `total`, `hasMore`, `remedy` and the `remedy.supply` inside it — and SHALL leave every other field typed and undescribed. `ok` SHALL say that false means the record was written but the directory still needs attention, that `message` names what to do, and not to retry the call. Every input argument this server defines (`cwd`, `note`, `draft`, `acceptNoHistory`, `formId`, `formIdOrPath`, `version`, `limit`, `skip`, `sort`, `select`, `tags`, `projectUrl`, `baseUrl`) SHALL keep its description. The fields nested inside a form, action or role body are Form.io's own and SHALL carry no description, their meaning being left to the `formio-schema` and `formio-actions` skills — except a body field this server gives a meaning of its own, which is `form.revisions` on `form_create` and `form_update`, because `acceptNoHistory` depends on it.

#### Scenario: Output fields are described only where a caller branches

- **WHEN** every tool's output schema is walked
- **THEN** the only properties carrying a description are `ok`, `status`, `total`, `hasMore`, `remedy` and `remedy.supply`

#### Scenario: Server-defined arguments keep their descriptions

- **WHEN** any tool declares one of the server-defined arguments
- **THEN** that argument carries a description

#### Scenario: Form.io body fields are left to the skills

- **WHEN** the fields nested inside an input argument are walked
- **THEN** none carries a description except `form.revisions` on `form_create` and `form_update`

### Requirement: Form.io document schemas declare only the fields a caller acts on

Each Form.io document's output schema SHALL stay open, so a field it does not declare passes through untouched, and SHALL declare only the fields a caller acts on, none of them required: a form `_id`, `title`, `name`, `path`, `type`, `display`, `components`, `revisions`, and `access` / `submissionAccess` (which the auth skills read before editing them); an action `_id`, `name`, `title`, `form`, `handler`, `method`, `settings`, `condition`, `priority`; a role `_id`, `title`, `admin`, `default`; a revision summary `_id`, `_vid`, `_vnote`, `_vuser`, `created`; an action type `name`, `title`, plus `settingsForm` on `action_type_get`; a template `roles`, `resources`, `forms`, `actions`. Every annotation `title` SHALL be at most four words.

#### Scenario: A document declares its acted-on fields and passes the rest through

- **WHEN** a Form.io document schema is inspected
- **THEN** it declares exactly its listed fields, requires none of them, and leaves additional properties open

#### Scenario: Annotation titles are short

- **WHEN** any tool's annotations are inspected
- **THEN** its `title` is at most four words

