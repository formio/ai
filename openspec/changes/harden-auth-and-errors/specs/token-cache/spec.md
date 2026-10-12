## ADDED Requirements

### Requirement: A CLI command signs out of a deployment

`formio-mcp project logout` SHALL remove the cached token for one deployment from `~/.formio/mcp-tokens.json`: the deployment named by `--base-url`, or else the one the directory (`--cwd`, default the current directory) resolves to. It SHALL leave every other deployment's entry intact, SHALL report which deployment it signed out of, and SHALL exit `0` when an entry was removed or none existed (saying which), `1` when the directory resolves no project (as `project get` reports it), `3` when the directory's project resolves but its deployment cannot be resolved, and `2` when the cache cannot be read or written. A `--base-url` that is not a valid URL SHALL exit `1`, naming the value as typed, as `project set` does.

#### Scenario: Sign out of the directory's deployment

- **WHEN** `formio-mcp project logout --cwd /work/app` runs and `/work/app` resolves to `https://forms.mysite.com/myproject` with a cached token
- **THEN** the token for `https://forms.mysite.com` is removed, other entries stay, and the command exits `0` naming that deployment

#### Scenario: Nothing to sign out of

- **WHEN** `formio-mcp project logout --base-url https://api.form.io` runs with no cached token for it
- **THEN** it exits `0` saying no token was cached for that deployment

#### Scenario: A directory with no project

- **WHEN** `formio-mcp project logout --cwd /work/unmapped` runs and nothing configures a project for `/work/unmapped`
- **THEN** it exits `1`, as `project get` does for that directory, names `--base-url` as the way to sign out of a deployment directly, and removes no entry

#### Scenario: A project whose deployment cannot be resolved

- **WHEN** `formio-mcp project logout --cwd /work/app` runs and `/work/app` resolves `https://myproject.mysite.com` with no deployment
- **THEN** it exits `3`, names `--base-url`, and removes no entry

#### Scenario: A mistyped deployment

- **WHEN** `formio-mcp project logout --base-url htps//api.form.io` runs
- **THEN** it exits `1`, naming `htps//api.form.io`, and removes no entry

### Requirement: The cache file is replaced atomically

Every write of `~/.formio/mcp-tokens.json` — a login saving a token, a rejected token being cleared, and `project logout` — SHALL write the new contents to a temporary file in the same directory, created with permissions `0600`, and rename it over the cache file, so a concurrent reader sees the previous file or the new one and never a partial one. A write that fails SHALL leave the previous file intact and no temporary file behind. `project logout` and the server's own reads SHALL share one reader, which distinguishes a missing file (no tokens) from one that cannot be read or parsed.

#### Scenario: Concurrent reader

- **WHEN** one process saves a token while another reads the cache
- **THEN** the reader parses either the previous contents or the new contents

#### Scenario: A failed write

- **WHEN** renaming the temporary file over the cache fails
- **THEN** the cache file keeps its previous contents and no temporary file remains
