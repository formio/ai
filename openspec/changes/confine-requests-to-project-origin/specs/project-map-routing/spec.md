## ADDED Requirements

### Requirement: A path-less customer project pairs only with a deployment on its registrable domain

A project URL with no path on a host outside `form.io` names its deployment nowhere: the deployment is a sibling sub-domain of the same parent domain. The pair rule SHALL accept such a project with a deployment only when both hosts have the same registrable domain, computed against the public suffix list so that multi-label suffixes (`co.uk`, `com.au`) are not treated as a shared parent. A host with no registrable domain — an IP address, or a single-label host such as `localhost` — SHALL be compared by requiring the deployment host to equal the project host with its first label removed, or the project host itself.

A deployment on another registrable domain SHALL be a deployment-half verdict, handled everywhere the existing "API root is not your deployment" verdict is: every writer (`project_set` and `project set`) SHALL refuse it before anything reaches disk, naming both hosts and the rule; the resolver SHALL set the recorded deployment aside with a note naming the record and the rule, and leave the deployment unresolved so the next call asks for it. A pair recorded by `project set --force` SHALL be honoured unchanged, as every forced pair is. Hosted-cloud projects and sub-directory projects are outside this rule: their deployment is derived, and the existing verdicts already govern a recorded value that differs.

#### Scenario: The documented sibling-sub-domain shape is accepted

- **WHEN** a write pairs `https://myproject.mysite.com` with `https://api.mysite.com`
- **THEN** it succeeds and no note or prompt is produced

#### Scenario: A deployment deeper in the same domain is accepted

- **WHEN** a write pairs `https://myproject.forms.mysite.com` with `https://forms.mysite.com`
- **THEN** it succeeds

#### Scenario: A multi-label public suffix is not a shared parent

- **WHEN** a write pairs `https://myproject.mysite.co.uk` with `https://api.mysite.co.uk`
- **THEN** it succeeds
- **AND WHEN** a write pairs `https://myproject.mysite.co.uk` with `https://api.othersite.co.uk`
- **THEN** it is refused naming both hosts

#### Scenario: A deployment on an unrelated domain is refused by a writer

- **WHEN** `project_set` is asked to pair `https://myproject.mysite.com` with `https://forms.othersite.com`
- **THEN** it fails naming both hosts and the registrable-domain rule
- **AND** nothing is recorded for that directory

#### Scenario: An unrelated deployment in a committed file is set aside at read

- **WHEN** a committed `formio.json` holds `projectUrl: "https://myproject.mysite.com"` and `baseUrl: "https://forms.othersite.com"`
- **THEN** resolution notes that the recorded Base URL was ignored, naming the file and the rule
- **AND** `project_get` reports `status: "base-url-unresolved"` for the project
- **AND** no request is sent to either host until a deployment is supplied

#### Scenario: A local single-label host pairs with its sub-domain project

- **WHEN** a write pairs `http://myproject.localhost:3000` with `http://localhost:3000`
- **THEN** it succeeds

#### Scenario: A forced pair is honoured

- **WHEN** a mapping entry recorded by `project set --force` pairs `https://myproject.mysite.com` with `https://forms.othersite.com`
- **THEN** resolution uses both values with no note

#### Scenario: Hosted and sub-directory projects resolve as before

- **WHEN** the Project URL is `https://examples.form.io` with no recorded deployment
- **THEN** the deployment resolves to `https://api.form.io` with no note
- **AND WHEN** the Project URL is `https://forms.mysite.com/myproject` with no recorded deployment
- **THEN** the deployment resolves to `https://forms.mysite.com` with no note
