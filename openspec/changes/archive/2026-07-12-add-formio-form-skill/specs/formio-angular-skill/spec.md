## MODIFIED Requirements

### Requirement: Parent skill description and trigger surface

The parent `formio-angular` `SKILL.md` frontmatter `description` SHALL claim ONLY framework-explicit Angular triggers — phrases that explicitly name Angular or request Angular-specific behavior. The description MUST include at least the following positive triggers:

- "build it in Angular"
- "Angular front-end for this Form.io project"
- "use Angular"
- "the Angular skill"
- Invocation from `formio-application` via handoff context (the orchestrator passes the framework choice explicitly).

The description MUST drop all plain-language "build me an app" triggers (those now belong to `formio-application`). The description MUST NOT contain generic phrases like "build me an app", "build me a tool", "spin up an app", "I need a tool to track", or bare domain archetypes like "task manager", "help desk", "CRM", "booking system".

The description MUST include a `Not for:` clause pointing at `formio-application` for generic build-an-app requests and for framework-agnostic "I want to build X" requests.

The description MUST include a `Not for:` clause pointing at `formio-form` for framework-agnostic embed/render-a-form requests that do not name Angular or `@formio/angular`.

The description MUST continue to include the existing `Not for:` clause pointing at `formio-angular-resources` for add-a-feature-to-an-existing-app requests.

#### Scenario: formio-angular only fires on Angular-explicit phrasing

- **WHEN** the user says "build it in Angular" or "I want an Angular front-end for my Form.io project"
- **THEN** the `formio-angular` skill activates
- **AND** `formio-application` does not activate

#### Scenario: formio-angular does not fire on generic build-an-app phrasing

- **WHEN** the user says "build me a CRM" (no mention of Angular)
- **THEN** the `formio-angular` skill does NOT activate
- **AND** `formio-application` activates instead

#### Scenario: formio-angular does not fire on generic embed phrasing

- **WHEN** the user says "embed this form in my web page" (no mention of Angular)
- **THEN** the `formio-angular` skill does NOT activate
- **AND** `formio-form` activates instead
- **AND** the `formio-angular` description contains a `Not for:` clause with the literal substring `formio-form`

#### Scenario: formio-angular description Not-for clause names the orchestrator

- **WHEN** the `formio-angular` `SKILL.md` frontmatter is inspected
- **THEN** its `description` contains the literal substring `formio-application`
- **AND** it contains a `Not for:` clause pointing at `formio-application`
