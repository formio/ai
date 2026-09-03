## RENAMED Requirements

- FROM: `### Requirement: A reserved branch leaves room for React form embedding`
- TO: `### Requirement: The embed branch dispatches to \`formio-react-form\``

## MODIFIED Requirements

### Requirement: Parent skill description and trigger surface

The `formio-react` `SKILL.md` frontmatter `description` SHALL follow the library's three-clause template — capability statement, a "Use when the user asks to …" trigger clause, and a "Not for: …" negative-trigger clause — and SHALL claim ONLY React-explicit triggers. It MUST include at least:

- Greenfield: "build it in React", "React front-end for this Form.io project", "use React", "use `@formio/react`", "the React skill".
- Existing application: "add Form.io CRUD to my React app", "wire this Form.io project into my existing React app".
- Embedding: "embed a Form.io form in React", "render a form in my React app".
- Invocation from `formio-application` via handoff context.

The description MUST NOT claim framework-agnostic build-an-app triggers ("build me an app", "spin up an app", bare archetypes such as "task manager", "CRM", "help desk"); those belong to `formio-application`. Neither may it claim framework-agnostic embed triggers ("embed a form", "render a form", "add this form to my page") with no framework named; those stay with `formio-form`. It MUST disambiguate from `formio-application` (orchestrator), `formio-resource-planner` (planner), `formio-form` (framework-agnostic embedding and all field-behavior questions), and `formio-angular` (the other framework implementor).

The description MUST fit the library-wide 1,024-character budget enforced by `skill-description-budget`.

#### Scenario: Description claims React-explicit triggers only

- **WHEN** `plugin/skills/formio-react/SKILL.md` frontmatter is parsed
- **THEN** its `description` contains React-naming triggers for all three branches
- **AND** it contains no generic build-an-app phrasing, no bare domain archetypes, and no unqualified embed phrasing

#### Scenario: React-named embed phrasing reaches this skill

- **WHEN** the user says "embed this form in my React app"
- **THEN** `formio-react` activates and dispatches to its embed branch
- **AND** `formio-form` does not activate
- **AND** the nested sub-skill is reached by that dispatch rather than by activating on its own

#### Scenario: Description fits the budget

- **WHEN** the description length is measured
- **THEN** it is at most 1,024 characters
- **AND** the same holds for `formio-react-resources` and `formio-react-form`

### Requirement: The embed branch dispatches to `formio-react-form`

Rendering a single Form.io form inside a React page is served by the nested sub-skill `formio-react-form`, and `formio-react`'s dispatch table SHALL carry it as a live row:

| Branch | Request shape | Chain |
| --- | --- | --- |
| Embed a form | Render one Form.io form inside a React page | `SETUP.md` (project URLs only, when needed) → `formio-react-form/SKILL.md` |

The embed branch SHALL NOT run `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, or `AUTH.md`, and SHALL NOT load `formio-react-resources`. Embedding one form is not an application build: it needs the project URLs and a provider, not a workspace, an auth surface, or a resource hierarchy. A request that turns out to want CRUD screens SHALL be re-dispatched to the appropriate CRUD branch rather than served from the embed branch.

The CRUD branches SHALL NOT document standalone form embedding; that boundary holds in the other direction too, and embedding guidance lives in the embed branch alone.

**Angular embedding remains reserved.** `formio-angular` disclaims embedding and points at `formio-form`, so an Angular user asking to embed a form receives Vanilla JS guidance rather than `@formio/angular`'s own component. `formio-react`'s dispatch table is not the place to fix that, but the gap SHALL be recorded where it is actionable — in `formio-form`'s host check, per the `formio-form-skill` capability — so closing it later is one sub-skill and one row, exactly as this change closed the React one.

#### Scenario: Embed branch dispatches to the sub-skill

- **WHEN** the embed branch is selected
- **THEN** `formio-react` loads `plugin/skills/formio-react/formio-react-form/SKILL.md` by path
- **AND** it does not load `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, `AUTH.md`, or the resources sub-skill

#### Scenario: An embed request that wants CRUD is re-dispatched

- **WHEN** an embed request turns out to be a request for list, create, and edit screens over a resource
- **THEN** the skill re-dispatches to the greenfield or existing-application branch
- **AND** it says why the branch changed

#### Scenario: CRUD branches still do not absorb embedding

- **WHEN** the greenfield and existing-application chains are inspected
- **THEN** neither documents standalone form embedding as its own topic

### Requirement: `formio-react` is a router over named branches

`formio-react` SHALL be structured as a **router**, not as one linear procedure. Its `SKILL.md` SHALL open by determining which branch the request belongs to and SHALL then load that branch's documents by path. Branch-specific procedure prose SHALL live in the sibling documents, not in `SKILL.md`; `SKILL.md` holds the dispatch table, the shared preflight, and the handoff contracts.

The dispatch table SHALL name, for each branch, its trigger shape and the document chain it loads:

| Branch | Request shape | Chain |
| --- | --- | --- |
| Greenfield application | Build a new React application around a Form.io project | `SETUP.md` → `BOOTSTRAP.md` → `CONFIG.md` → `AUTH.md` → `formio-react-resources/SKILL.md` |
| Existing application | Add Form.io resource CRUD to a React application that already exists | `SETUP.md` → `EXISTING.md` → (backfill `CONFIG.md` / `AUTH.md` as needed) → `formio-react-resources/SKILL.md` |
| Embed a form | Render one Form.io form inside a React page | `SETUP.md` (project URLs only, when needed) → `formio-react-form/SKILL.md` |

No row is reserved. Branches SHALL be mutually exclusive. When the request does not make the branch obvious, `formio-react` SHALL ask in ONE question round before loading any branch document. When the workspace state contradicts the stated branch — a greenfield request in a directory that already holds a React application, or an existing-application request in an empty directory — the skill SHALL surface the contradiction and confirm rather than proceeding on the stated branch.

`SKILL.md` SHALL NOT be written as a single all-encompassing procedure covering every branch inline. A reader arriving for one branch must not have to read another branch's steps to find their own.

#### Scenario: Branch is selected before any branch document loads

- **WHEN** `formio-react` activates on a request naming no branch
- **THEN** it asks which branch applies in one question round
- **AND** no branch chain has been loaded when the question is asked

#### Scenario: Workspace contradicts the stated branch

- **WHEN** the user asks to build a new React application in a directory that already contains one
- **THEN** the skill surfaces the contradiction and confirms before scaffolding

#### Scenario: SKILL.md stays a router

- **WHEN** `SKILL.md` is inspected
- **THEN** it contains the dispatch table
- **AND** the greenfield bootstrap steps and the existing-application inspection steps live in their sibling documents rather than inline

#### Scenario: No row is marked reserved

- **WHEN** the dispatch table is inspected after this change
- **THEN** every row names a real chain and none is marked reserved

### Requirement: Parent skill directory layout

The skills library SHALL provide a parent skill `formio-react` at `plugin/skills/formio-react/` containing:

- `SKILL.md` — the parent skill file with frontmatter `name: formio-react`
- `SETUP.md` — sibling reference document (no frontmatter) covering workspace and project-URL resolution
- `BOOTSTRAP.md` — sibling reference document (no frontmatter) covering Vite + React Router + TypeScript workspace bootstrap and dependency installation; loaded by the greenfield branch only
- `EXISTING.md` — sibling reference document (no frontmatter) covering the existing-application branch: workspace inspection, the router check, and which prerequisites to backfill
- `CONFIG.md` — sibling reference document (no frontmatter) covering `FormioProvider` wiring and the generated `src/config.ts`
- `AUTH.md` — sibling reference document (no frontmatter) covering the generated login / register / logout routes, the root-loader current user, and `requireUser` loader protection
- `formio-react-resources/SKILL.md` — the CRUD sub-skill file with frontmatter `name: formio-react-resources`
- `formio-react-resources/references/` — that sub-skill's reference material
- `formio-react-form/SKILL.md` — the embedding sub-skill file with frontmatter `name: formio-react-form`
- `formio-react-form/references/` — that sub-skill's reference material

Each sub-skill's directory name SHALL equal its declared `name`. The sibling documents MUST NOT contain skill frontmatter; they are loaded by the parent `SKILL.md` by path.

No eval harness SHALL live under `plugin/skills/`; the resources harness lives at `packages/skill-tests/evals/formio-react-resources/` per the `shipped-surface-boundary` capability, and the embedding sub-skill has none.

A symlink `.claude/skills/formio-react` SHALL resolve to `../../plugin/skills/formio-react`.

#### Scenario: Parent skill files exist

- **WHEN** the repository is inspected after the change is applied
- **THEN** `plugin/skills/formio-react/SKILL.md`, `SETUP.md`, `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, and `AUTH.md` all exist
- **AND** `plugin/skills/formio-react/formio-react-resources/SKILL.md` and `plugin/skills/formio-react/formio-react-form/SKILL.md` exist
- **AND** no `evals/` directory exists anywhere under `plugin/skills/formio-react/`
- **AND** `.claude/skills/formio-react` resolves to `plugin/skills/formio-react/`

#### Scenario: Sibling documents carry no frontmatter

- **WHEN** `SETUP.md`, `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, and `AUTH.md` are parsed
- **THEN** none of them begins with a YAML frontmatter block

#### Scenario: Both sub-skill directories match their declared names

- **WHEN** each nested `SKILL.md`'s frontmatter is parsed
- **THEN** its `name` equals the name of the directory containing it
