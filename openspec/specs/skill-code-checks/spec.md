# skill-code-checks Specification

## Purpose

Defines the checks that keep skill text true to the code: examples against the installed `@formio/*` packages, and tool names, arguments, and enum values against the registered tool schemas.

## Requirements
### Requirement: Skill code examples match the installed packages

`packages/skill-tests` SHALL check the fenced code examples in `formio-sdk`, `formio-form`, and `formio-react/formio-react-form`: every name an example imports from `@formio/js`, `@formio/js/utils`, `@formio/core`, or `@formio/react` SHALL be one that installed package exports, and every `formio-sdk` TypeScript example that is self-contained SHALL type-check against the installed `@formio/js` for wrong names (undeclared names, missing exports, unresolved modules, missing members of imported objects), and every `Formio.<member>` and `Utils.<member>` an example reads SHALL exist on the installed package's objects at run time. An example that is deliberately a fragment SHALL be marked so the check skips it.

#### Scenario: A non-existent export fails

- **WHEN** an example imports a name `@formio/js` does not export
- **THEN** the check fails naming the document, the example, and the name

#### Scenario: A made-up static fails

- **WHEN** a `formio-sdk` example calls `Formio.login`, which the installed `@formio/js` does not have
- **THEN** the member check fails naming the example and the member

### Requirement: Skill text names only registered tools and their real arguments

A test SHALL read the tools the server registers, with their input schemas, and SHALL fail when a markdown file under `plugin/skills/` names a tool that is not registered, names an argument beside a tool that its input schema does not take, or documents an enum value a schema does not allow. It SHALL NOT require prose to list a tool's required arguments, which the schema already gives the agent.

#### Scenario: A misspelled tool fails

- **WHEN** a skill names `form_revisions_list`
- **THEN** the test fails naming the file and the unregistered tool

#### Scenario: A stale argument fails

- **WHEN** a skill writes `form_update` with `publish: true`
- **THEN** the test fails naming the argument the schema does not take

