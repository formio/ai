## ADDED Requirements

### Requirement: Example identifier values MUST NOT contain collision-avoidance integer suffixes

Every capability-group `SKILL.md` body SHALL use clean, canonical identifier values in example payloads. An identifier value is a value associated with one of the keys `title`, `name`, `path`, `key`, or `machineName` inside a JSON- or YAML-style example.

An identifier value SHALL NOT end — either across the whole value or at the end of any `-`, `/`, or `:`-delimited segment — with a two-or-more digit integer suffix introduced purely for collision avoidance. Specifically, the following patterns SHALL fail validation:

- A `title` value ending with a space followed by two or more digits (e.g., `"title": "Employee 775"`).
- A `name`, `path`, `key`, or `machineName` value where any `-`, `/`, or `:`-delimited segment ends with `-` followed by two or more digits (e.g., `"name": "employee-510"`, `"path": "user/login-374"`, `"machineName": "example-906:example-771:save"`).

The rule SHALL NOT flag:

- MongoDB ObjectId hex strings embedded in URL paths (e.g., `/form/64d7b40e81d6ad28758b767e`).
- UUIDs in any key (e.g., `7b45f38b-dc26-5b1d-aa33-947522157c57`).
- PDF overlay field keys that are positional identifiers rather than collision suffixes (e.g., `"key": "f1010"`, `"key": "f1_01[0]"`).
- Single-digit numeric tokens such as `"key": "email2"`.

#### Scenario: Title with Postman-style numeric suffix fails validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"title": "Employee 775",`
- **THEN** `validateNoRandomIdSuffixes` SHALL emit a `content.random_id_suffix` issue naming the file and quoting the offending value

#### Scenario: Slug with dash-integer suffix fails validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"name": "employee-510",`
- **THEN** `validateNoRandomIdSuffixes` SHALL emit a `content.random_id_suffix` issue naming the file

#### Scenario: Multi-segment path with per-segment suffixes fails validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"path": "user/login-374",`
- **THEN** `validateNoRandomIdSuffixes` SHALL emit a `content.random_id_suffix` issue

#### Scenario: Multi-segment machineName with per-segment suffixes fails validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"machineName": "example-906:example-771:save"`
- **THEN** `validateNoRandomIdSuffixes` SHALL emit a `content.random_id_suffix` issue

#### Scenario: Clean identifier values pass validation

- **WHEN** a capability-group `SKILL.md` body contains the lines `"title": "Employee", "name": "employee", "path": "user/login", "machineName": "example:example:save"`
- **THEN** `validateNoRandomIdSuffixes` SHALL NOT emit any issue

#### Scenario: MongoDB ObjectId in URL path passes validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"path": "/form/64d7b40e81d6ad28758b767e/submission"`
- **THEN** `validateNoRandomIdSuffixes` SHALL NOT emit any issue

#### Scenario: PDF overlay field key passes validation

- **WHEN** a capability-group `SKILL.md` body contains the line `"key": "f1010"`
- **THEN** `validateNoRandomIdSuffixes` SHALL NOT emit any issue

#### Scenario: Real library passes validation after cleanup

- **WHEN** `validateLibrary` runs against the checked-in `.claude/skills/` after this change is applied
- **THEN** no `content.random_id_suffix` issue SHALL be reported for any capability-group `SKILL.md`
