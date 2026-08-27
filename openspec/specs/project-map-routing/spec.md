# project-map-routing Specification

## Purpose
Defines how every client resolves which Form.io project a tool call targets: one precedence order across the environment and the per-directory map, an actionable error when nothing resolves, `project_set` registered everywhere, base-URL fallback order, loud failure on an unreadable map, and one `cwd` schema for every client.
## Requirements
### Requirement: Project resolution follows one precedence order for every client

The server SHALL resolve the target Form.io project for each tool call in this order, with no dependence on which agent or host launched it. The order is by SCOPE, narrowest first — the source most specific to the code wins, and a global default is the weakest:

1. `projectUrl` from the nearest committed `formio.json`, discovered by the upward walk in `committed-project-config`.
2. The `env.FORMIO_PROJECT_URL` of the `~/.formio/projects.json` entry keyed by the caller-supplied `cwd`, when a `cwd` was supplied and an entry exists.
3. `FORMIO_PROJECT_URL` from the environment, when set and non-empty.
4. Otherwise, resolution fails (see the actionable-error requirement below).

No other variable participates. In particular there SHALL be no variable that OFFERS a project without applying one: the environment is already the weakest source, so a project set there is overridden by both stronger sources and therefore suggests without pinning.

A project and its deployment SHALL travel together. Precedence selects ONE record, and BOTH resolved values come from it: the base URL is that record's own — `baseUrl` in the committed file, `env.FORMIO_BASE_URL` in the matched map entry, `FORMIO_BASE_URL` in the environment — or, when that record names none, it is derived from that record's project URL. Halves SHALL NOT be combined across records: a base URL recorded in one record SHALL NOT pair with a project URL resolved from another, because nothing in a record that holds only half a configuration says which project the other half belongs to. Trailing slashes SHALL be stripped from both resolved URLs.

Mixing halves is what makes "which project is this deployment for?" a question at read time, and answering it requires a stored pairing that every writer must maintain and every reader must police. Keeping each record whole removes the question rather than answering it.

`FORMIO_PROJECT_URL` is not a pin. It is the weakest source, so a committed file or a personal mapping overrides it, and `project_set` CAN redirect a directory whose environment names a different project. A deployment that must target one project deterministically SHALL supply only the source it wants used.

When the winning record supplies no base URL, the server SHALL derive it from the shape of that record's project URL. There is no defaulting step: every base URL is either **derived** from the project URL or **absent and asked for**, which is what makes the Project URL the single configuration a user has to think about.

1. **Project URL on a `form.io` host** (the hosted cloud — `https://examples.form.io`) → the base URL is `https://api.form.io`, reported with source `derived`. The hosted cloud is the one deployment whose base URL is a constant, so this is a derivation from the host rather than a fallback.
2. **Project URL carrying a non-empty path** (sub-directory routing) → the base URL is that project URL **with its final path segment removed**, reported with source `derived`. The final segment is the project's name; everything preceding it is the deployment, which MAY itself be mounted at a sub-path. `https://forms.mysite.com/myproject` derives `https://forms.mysite.com`, and `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`. The derived value SHALL NOT be reduced to the bare origin.
3. **Project URL with no path on any other host** (sub-domain routing — `https://myproject.mysite.com`) → the base URL is **unresolved**, reported with source `unresolved`. The deployment lives on a different host of the same parent domain and nothing in the project URL names it, so it SHALL NOT be guessed.

The reported project-URL source SHALL be one of `committed`, `mapping`, or `environment`. The reported base-URL source SHALL be one of `committed`, `mapping`, `environment`, `derived`, or `unresolved`. There SHALL be no `default` source: a value reported as a default reads as a guess, and after the shape rules no guess remains.

An unresolved base URL SHALL NOT fail resolution itself, and SHALL NOT prevent a tool call that does not need one. `baseUrl` is consumed only by authentication — keying the JWT cache, building the portal-login candidates, and forming the `${baseUrl}/current` validation request — while every Form.io API request is built from the project URL. The resolved configuration SHALL therefore represent the base URL as absent rather than as a substituted value, and the requirement for one SHALL be enforced at the point authentication reads it. In particular, a deployment authenticating with `FORMIO_API_KEY` never reads the base URL, and SHALL keep working in this shape.

#### Scenario: A committed file outranks a personal mapping

- **WHEN** `formio.json` names `https://committed.form.io` and the map entry for the caller's `cwd` names `https://mapped.form.io`
- **THEN** the resolved project URL is `https://committed.form.io`
- **AND** the reported project-URL source is `committed`

#### Scenario: A personal mapping outranks the environment

- **WHEN** no committed file is found, the map entry for the caller's `cwd` names `https://mapped.form.io`, and `FORMIO_PROJECT_URL` is `https://env-project.form.io`
- **THEN** the resolved project URL is `https://mapped.form.io`
- **AND** the reported project-URL source is `mapping`

#### Scenario: The environment is the weakest source

- **WHEN** no committed file is found and no map entry exists, and `FORMIO_PROJECT_URL` is `https://env-project.form.io`
- **THEN** the resolved project URL is `https://env-project.form.io`
- **AND** the reported project-URL source is `environment`

#### Scenario: No variable offers a project without applying one

- **WHEN** the resolution order is inspected
- **THEN** it names exactly three project sources
- **AND** none of them is a suggestion the agent must confirm before it takes effect

#### Scenario: A hosted-cloud project derives its base URL

- **WHEN** no source supplies a base URL and the resolved project URL is `https://examples.form.io`
- **THEN** the resolved base URL is `https://api.form.io`
- **AND** the reported base-URL source is `derived`, not `default`

#### Scenario: A deployment mounted at a sub-path keeps its parent path

- **WHEN** no source supplies a base URL and the resolved project URL is `https://forms.mysite.com/one/two`
- **THEN** the resolved base URL is `https://forms.mysite.com/one`
- **AND** the reported base-URL source is `derived`

#### Scenario: A sub-domain-routed project leaves the base URL unresolved

- **WHEN** no source supplies a base URL and the resolved project URL is `https://myproject.mysite.com`
- **THEN** resolution succeeds with the base URL absent
- **AND** the reported base-URL source is `unresolved`
- **AND** it is not `https://api.form.io`

#### Scenario: Trailing slashes are stripped from resolved URLs

- **WHEN** the resolved project URL is `https://my-project.form.io/`
- **THEN** the value used for requests is `https://my-project.form.io`

### Requirement: Unresolvable projects fail with an actionable error naming project_set

When no project can be resolved, every project-scoped tool SHALL fail with an error that names the remedies available to the caller: calling `project_set` with the caller's `cwd`, running the equivalent command, and committing a `formio.json`. The error SHALL echo the `cwd` that was searched when one was supplied, and SHALL say that the upward walk for a committed file found none. It SHALL describe what a Project URL is, with an example per deployment kind, because that is the value it is asking for.

It SHALL NOT recite the base-URL guidance. The base URL is derived from whichever project URL the user supplies, so guidance about it cannot be acted on before that answer exists, and carrying it here made the message ask for two values when one is needed. It SHALL NOT name a suggested project, because no variable offers one.

A committed file that is present but unusable SHALL fail with a DISTINCT error naming that file's path and the offending key, and SHALL NOT report the directory as unconfigured.

A project URL that resolves while its base URL does not SHALL fail at the point authentication needs the value. That error SHALL name `project_set` and its `baseUrl` argument, the `baseUrl` key of a committed file, SHALL echo the resolved project URL, and SHALL explain that a path-less project URL on a customer domain names its deployment nowhere. It SHALL NOT report the project as unconfigured. Because the base URL is read only by authentication, that failure SHALL be scoped to callers that authenticate with a JWT: a deployment configured with `FORMIO_API_KEY` SHALL complete its calls normally in this shape.

#### Scenario: The unset-project error asks for the project alone

- **WHEN** nothing resolves a project for `cwd` of `/work/app`
- **THEN** the tool fails with an error containing `project_set`, `formio.json`, and `/work/app`
- **AND** it describes what a Project URL is
- **AND** it does not ask for a base URL
- **AND** the server remains connected

#### Scenario: No suggested project appears in the error

- **WHEN** nothing resolves a project and `FORMIO_DEFAULT_PROJECT_URL` is set in the environment
- **THEN** the error names no suggested project
- **AND** the message is identical to the one raised when that variable is unset

#### Scenario: A broken committed file is distinguishable from an unmapped directory

- **WHEN** a `formio.json` is found for `cwd` but cannot be parsed
- **THEN** the error names that file's path
- **AND** it does not claim the directory is unconfigured

#### Scenario: A JWT call against a project with no derivable base URL is actionable

- **WHEN** the resolved project URL is `https://myproject.mysite.com`, no source supplies a base URL, and no `FORMIO_API_KEY` is set
- **THEN** the tool fails with an error naming `project_set`, `baseUrl`, and the `formio.json` key
- **AND** the error echoes `https://myproject.mysite.com`
- **AND** no portal-login browser window is opened and no request is made to `https://api.form.io`

#### Scenario: An API-key deployment is unaffected by an unresolved base URL

- **WHEN** `FORMIO_API_KEY` is set and the resolved project URL is `https://myproject.mysite.com` with no base URL from any source
- **THEN** `form_list` proceeds against the project URL and succeeds

#### Scenario: hello needs no project

- **WHEN** nothing configures a project
- **AND** `hello` is called
- **THEN** it succeeds
### Requirement: project_set is registered for every client

`project_set` SHALL be registered unconditionally in `registerAllTools`, with no dependence on any host-mode environment variable. It SHALL write the supplied project URL — and base URL when supplied — to `~/.formio/projects.json` under the caller's `cwd`, with file mode `0600`.

#### Scenario: project_set is listed regardless of environment

- **WHEN** the server is started with no Form.io environment variables set
- **AND** the client requests `tools/list`
- **THEN** `project_set` appears in the tool list

#### Scenario: project_set writes a routable mapping

- **WHEN** `project_set` is called with `cwd` of `/work/app` and `projectUrl` of `https://my-project.form.io`
- **THEN** `~/.formio/projects.json` contains an entry keyed `/work/app` whose `env.FORMIO_PROJECT_URL` is `https://my-project.form.io`
- **AND** a subsequent project-scoped tool call with `cwd` of `/work/app` resolves to that project when `FORMIO_PROJECT_URL` is unset

### Requirement: A write stores the deployment its own record names, and never a global one

`project_set` (and the equivalent `formio-mcp project set` command) SHALL take the deployment it stores from three sources in this order, and from no other: the `baseUrl` the caller supplied, the deployment already recorded for this directory when the call does NOT change its project, and the value derived from the project URL being recorded. A write that changes the project keeps nothing — that deployment belonged to the project being replaced.

A global `FORMIO_BASE_URL` SHALL NOT be read by either writer. It is one value answering a per-project question, and the environment is a record of its own: copied into the mapping beside another record's project, it becomes a stale per-directory answer that then outranks derivation forever, which is the silent substitution the derivation rules exist to prevent. Every value SHALL be tested for truthiness rather than nullishness, so an empty string — a host prompt the user cleared — falls through instead of erasing the record.

Where none of the three sources yields a deployment — the path-less shape on a customer domain, recorded for the first time — the write SHALL fail naming the Base URL it needs, rather than store half a record. When a deployment IS recorded for the directory but could not be adopted, because the project URL stored beside it is unusable and therefore cannot vouch for it, the refusal SHALL name that value and say why it was not adopted: the user is otherwise asked to supply a value sitting on disk in the very entry they are repairing.

#### Scenario: Re-pointing a directory replaces its deployment

- **WHEN** `/work/crm` is mapped to `https://forms.example.com/old` with `FORMIO_BASE_URL` of `https://forms.example.com`
- **AND** `project_set` is called with that `cwd`, a `projectUrl` of `https://forms.example.com/new`, and no `baseUrl`
- **THEN** the entry's `env.FORMIO_BASE_URL` is the value derived for the new project, `https://forms.example.com`
- **AND** nothing is carried from the previous project's record

#### Scenario: An explicit base URL replaces the recorded one

- **WHEN** a directory is mapped to `https://myproject.mysite.com` with `FORMIO_BASE_URL` of `https://forms.mysite.com`
- **AND** `project_set` is called with a `baseUrl` of `https://api.mysite.com`
- **THEN** the entry's `env.FORMIO_BASE_URL` becomes `https://api.mysite.com`

#### Scenario: A global FORMIO_BASE_URL is never written into a record

- **WHEN** `FORMIO_BASE_URL` in the environment is `https://forms.mysite.com`
- **AND** `project_set` is called with a `projectUrl` of `https://myproject.mysite.com` and no `baseUrl`
- **THEN** the call fails naming the Base URL it needs, rather than adopting the environment's value

#### Scenario: A derivable project records its derived deployment

- **WHEN** `project_set` is called with a `projectUrl` of `https://forms.mysite.com/myproject` and no `baseUrl`
- **AND** `FORMIO_BASE_URL` in the environment is `https://api.form.io`
- **THEN** the new entry's `env.FORMIO_BASE_URL` is `https://forms.mysite.com`, derived from the project URL
- **AND** the environment's value is not read

#### Scenario: A stranded deployment is named rather than demanded again

- **WHEN** an entry holds an unusable `FORMIO_PROJECT_URL` beside a usable `FORMIO_BASE_URL`
- **AND** `project_set` is called with a valid path-less `projectUrl` and no `baseUrl`
- **THEN** the refusal names the recorded deployment and says it was not adopted because the project URL stored beside it is unusable

### Requirement: A hosted-cloud project's deployment is derived, never taken from a record

A project on a `form.io` host is served by `https://api.form.io` and by nothing else — that is what makes the Project URL the whole configuration for a hosted project — and a `*.form.io` host is never a Base URL. A recorded deployment naming anything else is therefore not a second opinion but a value that cannot be right, and left in place it becomes the portal-login URL and the token-cache key for a deployment the user does not use.

A WRITE SHALL refuse that pair, naming the deployment that does serve the project: the value is the caller's live answer, and a refusal is what corrects it before it reaches disk. A READ SHALL ignore the recorded value, resolve the derived deployment, and say which value it set aside and in which record — the right answer is knowable for this shape, so failing every tool call over a value the server can supply itself would be gratuitous, while silence would leave a stale variable invisible.

#### Scenario: A write pairing a hosted project with another deployment is refused

- **WHEN** `project_set` is called with a `projectUrl` of `https://examples.form.io` and a `baseUrl` of `https://forms.oldcorp.com`
- **THEN** the call fails naming `https://api.form.io` as the deployment that serves it
- **AND** nothing is recorded for that directory

#### Scenario: A recorded foreign deployment is ignored at read, in every record

- **WHEN** a committed `formio.json`, a mapping entry, or the environment pairs `https://examples.form.io` with `https://forms.oldcorp.com`
- **THEN** resolution reports `https://examples.form.io` on `https://api.form.io`
- **AND** a note names the ignored value and the record it came from

### Requirement: An unreadable project map fails loudly instead of reading as empty

A `~/.formio/projects.json` that exists but cannot be read or parsed SHALL raise a distinguishable error from every read and every write, naming the file and how to recover. A missing file remains the ordinary first-run state and SHALL still resolve to "no entry".

This SHALL hold per entry as well as for the file: an entry that is not an object with an `env` object of string values is unreadable, and SHALL raise the same error naming the directory. Every caller reaches straight for `entry.env.FORMIO_BASE_URL`, so an unvalidated entry surfaced as a bare `TypeError` reported as a generic failure. Validation SHALL be lazy — the map is shared, so a malformed entry for one directory SHALL NOT fail another directory's lookup or block mapping it.

Reporting a corrupt map as an empty one made every directory look unmapped, and the documented recovery — interview the user, then `project set` — rewrote the file from scratch, discarding every other directory's mapping. Refusing the write keeps the file intact for repair.

#### Scenario: A truncated map is not reported as an unmapped directory

- **WHEN** `~/.formio/projects.json` contains truncated JSON
- **AND** `formio-mcp project get` runs for a directory the file was mapping
- **THEN** it exits `2` naming `projects.json`, rather than reporting that no project is configured

#### Scenario: A malformed entry names the directory instead of throwing a TypeError

- **WHEN** `~/.formio/projects.json` maps `/work` to a string, or to an object with no `env` block
- **AND** an entry is read or written for `/work`
- **THEN** it raises the unreadable-map error naming `/work` and the file, and the file is left intact

#### Scenario: One malformed entry does not take the other directories down

- **WHEN** `~/.formio/projects.json` holds a malformed entry for `/broken` and a well-formed one for `/good`
- **THEN** reading and writing `/good` succeed, and `/broken` travels through the write verbatim

### Requirement: The project command distinguishes "nothing mapped" from "could not run"

`formio-mcp project` SHALL use three exit codes: `0` when it answered, `1` when the command ran and nothing is configured for the directory, and `2` when the command could not answer — a usage error, a malformed URL, a relative `--cwd`, or an unreadable project map. Skill documentation SHALL branch on the code rather than on a substring of the message.

Collapsing every non-zero exit into "nothing is mapped" sends the caller into an interview whose `project_set` then fails for the same unreported reason, so the user sees an interview-then-error loop that never names the cause.

#### Scenario: An unmapped directory is an answer

- **WHEN** `formio-mcp project get` runs for a directory with no entry and no environment pin
- **THEN** it exits `1` with a message naming `project set`

#### Scenario: A relative cwd is a failure, not an unmapped directory

- **WHEN** `formio-mcp project get --cwd relative/path` runs
- **THEN** it exits `2` with a message naming the absolute-path requirement

#### Scenario: A corrupt map is never overwritten

- **WHEN** `~/.formio/projects.json` contains truncated JSON
- **AND** a mapping write is attempted
- **THEN** the write fails and the file's contents are unchanged

### Requirement: The cwd parameter has one schema and one description for every client

The `cwd` parameter of project-scoped tools SHALL be an optional string that, when present, MUST be an absolute path. Its description SHALL name every source a project can come from, in the precedence order above — a committed `formio.json`, then the working-directory mapping, then `FORMIO_PROJECT_URL` as the weakest — and SHALL say that it should be passed on every call.

It SHALL NOT say that any environment variable removes the need for it, and SHALL NOT describe `FORMIO_PROJECT_URL` as a pin or as taking precedence over a mapping. The description is read on every tool call, more reliably than the server's `instructions`, so a stale precedence claim there is the most-read wrong answer the server ships.

The schema SHALL NOT vary by host mode, and the server SHALL NOT build a different schema depending on when the process started.

#### Scenario: Relative cwd is rejected

- **WHEN** a tool is called with `cwd` of `./app`
- **THEN** the call fails with a validation error stating that `cwd` must be an absolute path

#### Scenario: The cwd description carries the same precedence the resolver implements

- **WHEN** the `cwd` parameter's description is read
- **THEN** it names a committed `formio.json`, the working-directory mapping, and `FORMIO_PROJECT_URL`
- **AND** it identifies the environment as the weakest of the three
- **AND** it does not claim any variable pins the project or replaces `cwd`

#### Scenario: Omitted cwd is accepted when the environment supplies the project

- **WHEN** `FORMIO_PROJECT_URL` is set
- **AND** a tool is called with no `cwd`
- **THEN** the call proceeds against the environment-supplied project


### Requirement: A record holds a project and its deployment as a pair

Every write SHALL leave a record holding a complete configuration. `project_set` and `project set` SHALL derive the base URL from the project URL at save time and store BOTH in the record they write, so that a record naming a project always names the deployment that serves it.

Where the project URL names no deployment — a path-less project URL on a customer domain, the one shape derivation cannot answer — the write SHALL FAIL rather than record half a configuration, naming the base URL as the value it needs in the same call. The caller answering a `base-url-unresolved` report already holds the project URL, so supplying both costs the user nothing: the user is still asked for one value.

Writing a project URL SHALL replace that record's pair, discarding any base URL it held for the previous project. A base URL supplied alone SHALL amend the record that currently supplies the project, and where that record cannot hold it — the project is in a committed file or the environment while the call targets the mapping — the write SHALL FAIL naming the call that records the pair in the right place.

No record SHALL hold a base URL without the project URL it belongs to, and no stored pairing metadata SHALL be required to interpret one: the pair is the interpretation.

#### Scenario: Saving a project stores its derived deployment

- **WHEN** `project_set` records `https://examples.form.io` for a directory
- **THEN** the entry holds that project URL AND `https://api.form.io`
- **AND** a later resolution reports both from that one record

#### Scenario: Saving a project that names no deployment is refused

- **WHEN** `project_set` is asked to record `https://myproject.mysite.com` with no base URL
- **THEN** the call fails naming the base URL it needs
- **AND** nothing is written for that directory

#### Scenario: Re-pointing a directory replaces the whole pair

- **WHEN** a directory mapped to one project and its deployment is recorded with a different project URL
- **THEN** the entry holds the new project URL and the deployment derived for it
- **AND** the previous deployment is gone rather than carried

#### Scenario: A base URL alone amends the record that holds the project

- **WHEN** the mapping holds the project and `project_set` is called with a base URL alone
- **THEN** that entry's pair is updated in place
- **AND** when the project comes from a committed file, the call fails naming that file's path and the `baseUrl` key to add to it
- **AND** when the project comes only from the environment, the call fails naming the mapping write that records the pair

### Requirement: A write reports the pair the next read resolves

A write SHALL report the pair its own directory resolves to AFTER the write, obtained from the resolver rather than recomputed. Both entry points SHALL report it: `project_set` in `projectUrl` and `baseUrl`, and `project set` on its `Project URL:` and `Base URL:` lines. Where the write does not take effect — a committed `formio.json` governs the directory, so the mapping is only the fallback if that file goes away — the reported pair SHALL be the governing record's, the record just written SHALL be named in prose, and the wording SHALL NOT claim in the active voice that a value was set.

A write that lands on disk and leaves the directory resolving no deployment SHALL NOT report success. `project_set` SHALL report `ok` false while still carrying the resolved pair and `changed`, and `project set` SHALL exit `3`; both SHALL carry the reader's own report, naming the file and the key to edit. The record SHALL still be written: it is a legitimate fallback, and the failure being reported is the state of the directory, not of the write.

Resolution notes emitted while answering that question — a `formio.json` passed over, a recorded base URL set aside — SHALL reach the caller, deduplicated against the notes the write itself collected, and SHALL survive a throw from any stage of the command.

#### Scenario: A mapping written under a committed file reports the governing pair

- **WHEN** `project_set` records a project for a directory a committed `formio.json` governs
- **THEN** the reported pair is the one that committed file resolves
- **AND** the message names the record just written and says it does not take effect

#### Scenario: A write that leaves no deployment is not a success

- **WHEN** a base URL is recorded for a directory whose committed `formio.json` names the same project and supplies no deployment
- **THEN** the record is written
- **AND** `project_set` reports `ok` false, and `project set` exits `3`
- **AND** the message names that file and the `baseUrl` key to add to it

#### Scenario: A committed file the pair rule refuses fails the write that follows it

- **WHEN** a committed `formio.json` holds a URL that parses but the pair rule refuses
- **THEN** the write does not report success
- **AND** the failure names that file rather than describing the record just written

#### Scenario: A resolution note reaches the caller once

- **WHEN** a write resolves through a `formio.json` holding a base URL that is set aside
- **THEN** the note explaining it is reported by both entry points
- **AND** it appears once, not once per walk of the tree

### Requirement: A present-but-unusable record still governs its directory

A mapping entry that exists and cannot be honoured SHALL be treated by every writer as the record that governs that directory, not as an absent one. This SHALL hold for an entry that is structurally malformed and for one whose `FORMIO_PROJECT_URL` is not an http(s) URL, which is validated only where the record wins and therefore reaches a writer looking well-formed.

A write carrying no project URL SHALL be refused against such an entry, naming that entry as the reason and quoting the recorded value back, because that entry is the only place the value exists and the repair replaces it. The refusal SHALL NOT attribute the project to any other record.

This SHALL apply only where the mapping is the record that would govern. A committed `formio.json` outranks it, so a broken entry beneath one decides nothing, and the refusal there SHALL name that file and the key to add to it rather than the mapping.

A mapping SHALL be keyed by the resolved directory, so that one directory has one record however the caller spelled the path.

#### Scenario: A broken entry is not reported as the environment holding the project

- **WHEN** a directory's mapping entry holds a value that is not an http(s) URL and `FORMIO_PROJECT_URL` names a project
- **THEN** a write carrying only a base URL is refused
- **AND** the refusal names the entry and quotes the recorded value
- **AND** it does not name the environment's project

#### Scenario: A structurally malformed entry reaches the same answer

- **WHEN** a directory's mapping entry is not an object holding an `env` of strings
- **THEN** a write carrying only a base URL is refused without attributing the project elsewhere

#### Scenario: A trailing slash is the same record

- **WHEN** a project is recorded for `<dir>/` and read back for `<dir>`
- **THEN** the same pair resolves
- **AND** the map holds one entry for that directory, not two

### Requirement: An invalid pair is refused wherever it is formed, by one rule

Two pairs are not configurations at all, and ONE classification SHALL decide both for every writer and for the resolver — the rule written once for writes and again for reads is how a case escaped the read-side copy.

The first is the hosted cloud's own API root offered as a project URL. It IS a `form.io` host, so it derives itself as its own deployment; diagnosing it as an Open Source install would be wrong, and it is the likeliest mistake on this surface — the deployment URL pasted where the project URL goes. The refusal SHALL say it is the Base URL every hosted project shares, not a project URL, and ask which project. It SHALL be recognised by HOST rather than by an exact string, so `http://api.form.io` and `https://api.form.io/<name>` — the same mistake, and the second is a shape the server's own guidance already calls out — are refused with it; the host SHALL be compared whole, never as a suffix, so a lookalike host is a different deployment.

The second is a Base URL identical to the Project URL, which names a server with no project layer: the Form.io Open Source server serves one set of forms at its own root, so the two URLs collapse onto each other. The refusal SHALL name the value, state that the Form.io Agentic Coding tools are built for the Form.io Enterprise Server, and say why the two URLs cannot be the same: every tool here addresses a project UNDER a deployment, and project roles, actions, stages, imports and exports have no counterpart on that server. It SHALL name what to do instead — a project on an Enterprise deployment, or a hosted-cloud project served by `https://api.form.io`.

The classification SHALL judge the EFFECTIVE pair — the recorded deployment, or the derived one where the record holds none — because the collapse is about what the tools would target, not what happens to be written down: `https://api.form.io` derives itself, so a record holding it as the project with no deployment beside it collapses exactly as a recorded pair does.

Every write that forms a pair SHALL refuse it before anything reaches disk, so the user is not left to diagnose a string of unexplained 404s from a later tool call. And the resolver SHALL refuse it at the point of use, because a hand-written `formio.json`, a hand-edited mapping entry, and the environment never pass through a writer. The read-time refusal is per record, in that record's own repair vocabulary: a committed file fails naming the file, like every other unusable committed value; a mapping entry fails naming the entry and the `project_set` rewrite that replaces it; the environment — a suggestion, read tolerantly everywhere else — is ignored with a note naming the cause, and resolution falls through to the interview.

#### Scenario: The Base URL answers with the Project URL

- **WHEN** a write is asked to pair `https://forms.mysite.com` with itself
- **THEN** it fails naming that URL and the Enterprise Server requirement
- **AND** nothing is recorded for that directory

#### Scenario: The API root is offered as a project URL

- **WHEN** a write is asked to record `https://api.form.io` as the Project URL
- **THEN** it fails saying that is the hosted cloud's shared Base URL, not a project URL, and asks which project
- **AND** nothing is recorded for that directory

#### Scenario: A hand-written committed pair that collapses is refused at read, naming the file

- **WHEN** a committed `formio.json` holds `https://api.form.io` as `projectUrl`, or the same URL as both keys
- **THEN** resolution fails as an unusable committed file, naming its path and the cause

#### Scenario: A hand-edited mapping pair that collapses is refused at read, naming the entry

- **WHEN** a mapping entry holds `https://api.form.io` as `FORMIO_PROJECT_URL`, or the same URL as both values
- **THEN** resolution fails as an unusable entry, naming the directory and the `project_set` rewrite that replaces it

#### Scenario: An environment pair that collapses is ignored with a note

- **WHEN** `FORMIO_PROJECT_URL` is `https://api.form.io`, or names the same URL as `FORMIO_BASE_URL`
- **THEN** the environment record is set aside with a note naming the cause
- **AND** resolution continues to the not-configured interview rather than failing

#### Scenario: A real deployment is unaffected

- **WHEN** a write pairs `https://myproject.mysite.com` with `https://api.mysite.com`
- **THEN** it succeeds
