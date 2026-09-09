## ADDED Requirements

### Requirement: BOOTSTRAP installs one named Angular skill, never the repository

`plugin/skills/formio-angular/BOOTSTRAP.md` Step 2 SHALL install exactly the `angular-new-app` skill from `https://github.com/angular/skills` using the `skills` CLI's `--skill` flag: `npx skills add https://github.com/angular/skills --skill angular-new-app -a <agent> -y`. The `--all` flag SHALL NOT appear in any markdown file under `plugin/skills/formio-angular/`, because the CLI defines it as shorthand for `--skill '*' --agent '*' -y`, which installs every skill in the repository into every agent's directory and silently discards the `-a <agent>` selection.

Before asking for approval, the step SHALL show the repository's contents with `npx skills add https://github.com/angular/skills --list`, so the user approves a named skill they have seen listed. The offer SHALL state three things: the source is the Angular team's official repository, exactly one skill named `angular-new-app` is installed, and the installed skill becomes instructions this session follows. `SKILL.md`'s BOOTSTRAP summary SHALL describe the same scoped install.

The repository SHALL NOT be pinned to a commit SHA in the skill text: a SHA written into a shipped skill goes stale and breaks the install, and the named-skill scope, the `--list` preview, and the explicit approval gate are the controls this skill applies.

#### Scenario: Scoped install command

- **WHEN** `BOOTSTRAP.md` Step 2 is inspected
- **THEN** it contains `--skill angular-new-app`
- **AND** it contains `-a <agent>`
- **AND** it contains a `--list` preview invocation before the approval question

#### Scenario: --all banned across the skill family

- **WHEN** any `plugin/skills/formio-angular/**/*.md` contains the token `--all`
- **THEN** the `formio-angular` flow-contracts suite fails naming the file

#### Scenario: Offer names one skill

- **WHEN** the offer paragraph in `BOOTSTRAP.md` is inspected
- **THEN** it names `angular-new-app` as the only skill installed
- **AND** it no longer states that every skill in the repository is installed

### Requirement: Form.io and Bootstrap installs respect the workspace's configured save prefix

`BOOTSTRAP.md` SHALL keep the caret (`^`) range as the default prefix for the `@formio/angular`, `@formio/js`, `bootstrap`, and `bootstrap-icons` installs, and SHALL state that the committed lockfile is what fixes the resolved versions. When the workspace has configured `save-exact=true` or `save-prefix=~` in its `.npmrc` (or the package manager's equivalent), the install SHALL honor that configuration: `BOOTSTRAP.md` SHALL NOT instruct the agent to pass `--save-prefix='^'` to override it, and SHALL NOT instruct the agent to rewrite an exact or tilde entry back to `^` and re-run the install. The Step 4 verification SHALL accept an entry in any of the three range forms as long as it resolves to the version captured in Step 1.

#### Scenario: No override of the user's .npmrc

- **WHEN** `BOOTSTRAP.md` is inspected
- **THEN** it does not contain `--save-prefix='^'`
- **AND** it does not instruct rewriting an exact pin or `~` range to `^`

#### Scenario: Caret remains the default with the lockfile named

- **WHEN** the "Add the Form.io packages" section is inspected
- **THEN** the install command still uses `@^<FORMIO_ANGULAR_VERSION>` and `@^<FORMIO_JS_VERSION>`
- **AND** the section states that the committed lockfile carries the resolved versions

#### Scenario: Verification accepts a configured prefix

- **WHEN** the workspace's `.npmrc` sets `save-exact=true` and the install writes `"@formio/angular": "10.0.1"`
- **THEN** Step 4's package.json check passes

### Requirement: The resources sub-skill imports through the tool and defers version resolution to BOOTSTRAP

`formio-angular-resources/SKILL.md`'s "Next steps" block SHALL direct the user to import a project template with the `project_import` tool and SHALL NOT show a hand-rolled authenticated request, because the library forbids direct requests against a deployment. `formio-angular-resources/references/app-integration.md` SHALL NOT instruct the agent not to pin versions; it SHALL point at `BOOTSTRAP.md` Step 1's registry resolution and name the committed lockfile as what pins the installed versions.

#### Scenario: No hand-rolled import request

- **WHEN** any `plugin/skills/formio-angular/**/*.md` is inspected
- **THEN** none contains a `curl` request carrying `x-jwt-token`
- **AND** the resources sub-skill's Next steps name the `project_import` tool

#### Scenario: app-integration defers to registry resolution and the lockfile

- **WHEN** `app-integration.md` is inspected
- **THEN** it does not contain "Do not pin versions"
- **AND** it names the committed lockfile
