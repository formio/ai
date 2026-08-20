## ADDED Requirements

### Requirement: A committed `formio.json` records which project a directory targets

The server SHALL support a committed configuration file named `formio.json` that records the Form.io project a directory targets. Its purpose is to be tracked in version control: unlike `~/.formio/projects.json`, which is keyed by absolute path and lives in the user's home directory, this file travels with the code, survives a clone, and is reviewable in a pull request.

The file SHALL be a JSON object with:

- `projectUrl` (required) — the full URL of the Form.io project this directory targets.
- `baseUrl` (optional) — the deployment hosting it. When omitted, the base URL resolves through the same shape-aware rules any other source uses, so a hosted-cloud or sub-directory-routed project needs no entry.

Both values SHALL be validated exactly as the `project_set` tool validates them: `http`/`https` only, trailing slashes stripped, an actionable error naming the offending key otherwise. Unknown keys SHALL be ignored rather than rejected, so the file can carry a `$schema` or comments-by-convention without failing resolution.

The file SHALL hold exactly one target. Named environments and environment selectors are deliberately out of scope: a branch that deploys the same application to another environment commits that environment's values, so the target is a property of the checkout rather than of a runtime switch.

The file SHALL NOT be a place for credentials. A project URL and a base URL name infrastructure, not secrets; `FORMIO_API_KEY` and any token SHALL continue to come from the environment or the token cache.

#### Scenario: A minimal file names only the project

- **WHEN** `formio.json` contains `{"projectUrl": "https://examples.form.io"}`
- **THEN** the resolved project URL is `https://examples.form.io`
- **AND** the base URL resolves to `https://api.form.io` by the hosted-cloud rule, exactly as it would from any other source

#### Scenario: A file names both URLs

- **WHEN** `formio.json` contains `{"projectUrl": "https://myproject.mysite.com", "baseUrl": "https://forms.mysite.com"}`
- **THEN** both values are used as written

#### Scenario: An unusable URL in the file is actionable

- **WHEN** `formio.json` contains `{"projectUrl": "not-a-url"}`
- **THEN** resolution fails with an error naming the file's path and the `projectUrl` key
- **AND** the error does not report the directory as unconfigured, because a file IS present

#### Scenario: Unknown keys are ignored

- **WHEN** `formio.json` carries a `$schema` key alongside `projectUrl`
- **THEN** resolution succeeds and ignores the extra key

#### Scenario: A missing projectUrl is actionable

- **WHEN** `formio.json` exists but has no `projectUrl`
- **THEN** resolution fails with an error naming the file's path and the missing key

### Requirement: Discovery walks up from the caller's directory and stops at the repository boundary

The server SHALL locate `formio.json` by walking from the caller's `cwd` toward the filesystem root and taking the FIRST file it finds. The nearest file therefore wins, which is what makes per-folder targeting work without any additional mechanism: `apps/web/formio.json` governs `apps/web` while the repository root's file governs its siblings.

The walk SHALL NOT ascend past a directory containing a `.git` entry. When a `.git` directory is reached with no file found, the walk stops there and reports no committed configuration. Without that boundary a stray `formio.json` in a home directory would silently govern every repository beneath it — the same class of silent wrong-deployment failure the shape-aware base-URL rules exist to prevent.

When the caller supplies no `cwd`, discovery SHALL start from the MCP server's own working directory, and the resolution report SHALL say so, on the same terms the existing no-`cwd` note already uses.

#### Scenario: The nearest file wins

- **WHEN** a repository root holds `formio.json` naming project A, `apps/web/formio.json` names project B, and a tool is called with `cwd` of `<repo>/apps/web`
- **THEN** the resolved project is B

#### Scenario: A parent file governs a directory with none of its own

- **WHEN** a repository root holds `formio.json` naming project A and a tool is called with `cwd` of `<repo>/apps/api`, which has no file
- **THEN** the resolved project is A

#### Scenario: The walk stops at the repository boundary

- **WHEN** `$HOME/formio.json` exists, `$HOME/work/app/.git` exists, and a tool is called with `cwd` of `$HOME/work/app`
- **THEN** no committed configuration is found
- **AND** `$HOME/formio.json` does not govern that directory

#### Scenario: A file at the repository root inside the boundary is found

- **WHEN** `<repo>/.git` and `<repo>/formio.json` both exist and a tool is called with `cwd` of `<repo>/packages/thing`
- **THEN** the repository root's file is found, because the walk includes the directory holding `.git`

#### Scenario: An unreadable file is not an absent file

- **WHEN** a `formio.json` is found but cannot be parsed
- **THEN** resolution fails with an error naming its path
- **AND** the failure is distinguishable from finding no file at all, so a caller is not sent to write a mapping that would leave the broken file in place

### Requirement: The file belongs to the application being built, not to unrelated directories

`formio.json` SHALL be created in the workspace of the application it configures — the folder that application lives in — by the skills that scaffold or extend that application. It records what that application targets, which is why it travels with that application's source.

Because discovery walks upward, a `formio.json` governs every directory beneath it. Creating one at the root of a working tree that holds unrelated projects therefore points all of them at one Form.io project, which is a misconfiguration rather than a shortcut. `project set --scope repo` SHALL write to the `--cwd` directory when the upward walk finds no existing file, so the default placement is the directory the caller named rather than an ancestor.

This library's own repository SHALL NOT contain a `formio.json`. One committed here would be discovered by every `project get` run anywhere in the tree — every skill invocation, every eval run, every test that resolves a project — and would silently govern all of them. A guard test SHALL assert its absence, because the footgun is created by the same upward walk that makes the feature work and is invisible until something resolves the wrong project.

#### Scenario: The scaffolding skills write it into the application workspace

- **WHEN** a skill scaffolds a new application into `<workspace>`
- **THEN** any `formio.json` it writes is created at `<workspace>`, alongside that application's own source
- **AND** it is not written to an ancestor of `<workspace>`

#### Scenario: repo scope writes the named directory when no file exists

- **WHEN** `project set --scope repo --cwd /repo/apps/web` runs and the upward walk finds no existing file within the repository
- **THEN** the file is created at `/repo/apps/web/formio.json`
- **AND** no file is created at `/repo`

#### Scenario: This repository carries no committed configuration of its own

- **WHEN** this repository is inspected
- **THEN** no `formio.json` exists at its root or in any tracked directory
