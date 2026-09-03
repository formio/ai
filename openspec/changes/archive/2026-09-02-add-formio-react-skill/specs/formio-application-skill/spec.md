## MODIFIED Requirements

### Requirement: FRAMEWORK.md defines a registry with single- and multi-framework routing

`FRAMEWORK.md` SHALL contain a table of installed UI-framework skills in the following shape:

| Framework | Entry skill      | Extend sub-skill           | Detection signal                                                      | Default |
| --------- | ---------------- | -------------------------- | --------------------------------------------------------------------- | ------- |
| Angular   | `formio-angular` | `formio-angular-resources` | `angular.json` in workspace root OR `@angular/core` in `package.json` | yes     |
| React     | `formio-react`   | `formio-react-resources`   | `react` in `package.json` dependencies                                | no      |

Exactly one row SHALL carry `Default: yes`. It is Angular, because its implementor configures the library-provided `@formio/angular` `FormioResource` module while React's generates its runtime into the application.

`FRAMEWORK.md` body MUST document:

- That routing is driven by this table.
- That when the table has exactly one active row, Step 4 routes silently (no user question).
- That when the table has multiple active rows, Step 4 asks the user to pick, in one question round, using the client's structured question mechanism — which it MAY name as a parenthetical example only. With both Angular and React registered, this is now the live build-new path, and each option MUST be described in terms of what it generates ("Generate an Angular workspace using `@formio/angular`", "Generate a Vite + React Router workspace using `@formio/react`").
- That the `Default: yes` row is presented FIRST in that question round and labelled as the default, and that the question round MUST be a real choice rather than a confirmation of a decision already made — the prompt does not name a framework as chosen, and no framework work begins before the answer arrives.
- That the default resolves the question only when the user declines to choose — an explicit "no preference", "you pick", "whatever you recommend", a non-answer, or a dismissed question round. It is NOT a licence to skip asking. Step 4 SHALL state which framework it is proceeding with whenever the default resolves the choice, so a user who did not mean to defer can correct it.
- That modify-existing workspaces are detected via the "Detection signal" column, and if exactly one signal matches the routing is direct.
- That a workspace matching more than one signal — for example one carrying both `angular.json` and a `react` dependency — is a multi-match, and Step 4 asks the user to pick in one question round rather than guessing from signal order.
- That each row's Detection signal SHALL be written independently of every other row's, testing only for its own framework's presence. A signal that excludes another framework (`react` AND no `angular.json`) collapses the multi-match case into a single match and makes the tie-break branch unreachable, which puts the table's own routing rule in conflict with itself.
- The Step 4a `frontend-design` pre-check: detect the skill by name, accepting more than one registered form rather than a single client's prefix; when it is missing, offer the install in one question round, naming where the skill ships and deferring the mechanism to the running client's own skill-install route; on decline, apply the Bootstrap 5 brief from `formio-angular/BOOTSTRAP.md` Step 7d inline, disclose that on each UI approval gate, and hand `frontendDesignStatus` downstream. The document MUST NOT instruct a client-specific plugin-install command, plugin browser, or reload command.
- How to add a new framework entry — the concrete instruction for whoever is adding a further framework later. Its worked example SHALL name a framework that is NOT already a row (Vue). The shipped document uses React as that example, carrying a detection signal (`vite.config.* with react deps OR next.config.*`) that disagrees with React's real row and names Next.js, which is out of scope; leaving it in place puts two contradictory React signals in one file, one of them in the section a future author copies from.

#### Scenario: Multi-framework registry asks the user

- **WHEN** intent = build-new and the table contains both the Angular and React rows
- **THEN** Step 4 presents both frameworks in one question round before routing
- **AND** the instruction names no client tool as the mechanism

#### Scenario: React workspace detection routes directly

- **WHEN** intent = modify-existing and the workspace has `react` in `package.json` and no Angular signal
- **THEN** exactly one row matches, so Step 4 loads `plugin/skills/formio-react/formio-react-resources/SKILL.md` by path without asking the user

#### Scenario: Existing Angular workspace still routes directly

- **WHEN** intent = modify-existing and the workspace contains `angular.json`
- **THEN** Step 4 routes to `formio-angular-resources` without asking the user

#### Scenario: Workspace matching both signals asks the user

- **WHEN** intent = modify-existing and the workspace contains both `angular.json` and a `react` dependency
- **THEN** Step 4 asks the user which framework to extend, in one question round

#### Scenario: The how-to-add example does not name a live framework

- **WHEN** `FRAMEWORK.md`'s "How to add a new framework" section is inspected
- **THEN** its worked example names Vue, not React or Angular
- **AND** the file contains no React detection signal other than the one in the registry table

#### Scenario: Pre-check degrades when frontend-design is declined

- **WHEN** Step 4a finds `frontend-design` unavailable and the user proceeds without it
- **THEN** `FRAMEWORK.md` instructs applying the Bootstrap 5 brief inline
- **AND** it instructs disclosing that on each UI approval gate
- **AND** it names where `frontend-design` ships without prescribing a client-specific install command
- **AND** it contains no `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`

### Requirement: formio-application description claims plain-language triggers and names the framework skills

The `formio-application` `SKILL.md` frontmatter `description` SHALL claim plain-language build-an-app and extend-an-app triggers WITHOUT requiring the user to know any UI framework or Form.io terminology, and SHALL fit the library's description budget (see the `skill-description-budget` capability). Example triggers the description MUST claim include:

- Build-new: "build me an app", "create a CRM", bare domain archetypes ("task manager", "help desk").
- Extend-existing: "also track X", "add a way to see Y".

The description MUST state that this skill is the library's default build-an-app entry point. The framework-selection behavior (auto-pick with one installed framework, ask with several) is a body concern and is NOT required in the description.

The description MUST include `Not for:` clauses pointing at:

- `formio-angular` for framework-explicit Angular requests.
- `formio-angular-resources` for framework-explicit Angular extension requests.
- `formio-react` for framework-explicit React requests.
- `formio-react-resources` for framework-explicit React extension requests.
- `formio-resource-planner` for data-model-only planning requests without building an app.
- `formio-api` for endpoint lookups.
- `formio-form` for embedding or rendering a single form in an existing page or application (no app build or orchestration).
- `formio-form-builder` for standalone single-form creation requests — one form to collect responses, not a data model, resources, or an app around the data.


#### Scenario: formio-application claims generic build-new triggers

- **WHEN** the user says "build me a tool to track maintenance requests" (no framework or Form.io terminology)
- **THEN** the `formio-application` skill activates
- **AND** none of `formio-angular`, `formio-angular-resources`, `formio-react`, or `formio-react-resources` activates

#### Scenario: formio-application claims generic extend triggers

- **WHEN** the user says "also let customers leave reviews on products" in a workspace that already has a framework app wired
- **THEN** the `formio-application` skill activates
- **AND** no framework extend sub-skill activates directly

#### Scenario: Framework-explicit phrasing does NOT route through formio-application

- **WHEN** the user says "build it in Angular", "add an Angular module for X", "build it in React", or "add a React route for X"
- **THEN** the matching framework skill activates directly
- **AND** `formio-application` does not activate

#### Scenario: Embed-a-form phrasing does NOT route through formio-application

- **WHEN** the user says "embed this form in my existing site" or "render this form on my page" (no app build requested)
- **THEN** `formio-form` activates
- **AND** `formio-application` does not activate
- **AND** the `formio-application` description's `Not for:` clauses contain the literal substring `formio-form`

#### Scenario: Standalone form-creation phrasing does NOT route through formio-application

- **WHEN** the user says "build me a form to collect customer feedback" or "create a survey" (a standalone form, not an app or data model)
- **THEN** `formio-form-builder` activates
- **AND** `formio-application` does not activate
- **AND** the `formio-application` description's `Not for:` clauses name the backtick-delimited `` `formio-form-builder` ``

#### Scenario: Description names no MCP-configuration step

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains no `.mcp.json` reference and no restart-pause phrasing
- **AND** this matches the shipped skill body, which states there is no restart boundary on either branch

#### Scenario: Description fits the budget

- **WHEN** the `formio-application` `SKILL.md` frontmatter is inspected
- **THEN** its `description`, whitespace-normalized, is ≤ 1,024 characters

## ADDED Requirements

### Requirement: Build-new asks which framework, defaulting to Angular

The framework question belongs to greenfield builds only. On the **build-new** branch with more than one active registry row, `formio-application` SHALL ask the user which UI framework to build in, in ONE question round, before any framework skill is invoked and before any workspace is scaffolded. The question SHALL offer one option per active registry row, each described by what it generates, with the `Default: yes` row first and labelled as the default.

When the user declines to choose — "no preference", "you pick", "whatever", a non-answer, or a dismissed question — `formio-application` SHALL proceed with the `Default: yes` framework and SHALL say which one it picked in the same message it continues with. It SHALL NOT re-ask, and it SHALL NOT stall waiting for a preference the user has already declined to express.

The question SHALL NOT be asked on the **modify-existing** branch. An existing workspace's framework is a fact to be detected, not a preference to be collected; the only question there is the double-match tie-break, which is a different question with a different cause.

A user who names a framework in their original request has already answered. `formio-application` SHALL treat that as the answer and skip the round — but framework-explicit phrasing usually routes to the framework skill directly and never reaches Step 4 at all.

#### Scenario: Build-new asks before scaffolding anything

- **WHEN** intent = build-new, the registry has both rows, and the user's request named no framework
- **THEN** the user is asked which framework to build in, in one question round
- **AND** no framework skill has been invoked and no workspace files have been written when the question is asked

#### Scenario: Angular is offered first and labelled default

- **WHEN** the framework question round is presented
- **THEN** the Angular option appears first
- **AND** it is labelled as the default
- **AND** each option states what it generates

#### Scenario: No preference falls through to Angular, and says so

- **WHEN** the user answers "no preference" or dismisses the question round
- **THEN** `formio-application` proceeds with Angular
- **AND** it states that it is proceeding with Angular as the default before continuing
- **AND** it does not re-ask

#### Scenario: Framework named in the original request skips the round

- **WHEN** the user's build-new request already names React
- **THEN** Step 4 routes to `formio-react` without asking

#### Scenario: Modify-existing never asks the preference question

- **WHEN** intent = modify-existing and exactly one detection signal matches
- **THEN** no framework preference question is asked
- **AND** routing follows the matched row
