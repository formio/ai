## Purpose

Defines the on-disk JWT cache: keyed by project URL, readable and clearable by that key, and written with restrictive file permissions.
## Requirements
### Requirement: Tokens are cached to disk keyed by project URL

The token cache module SHALL store JWTs in `~/.formio/mcp-tokens.json` as a JSON object keyed by project URL. The cache directory and file SHALL be created if they do not exist.

#### Scenario: Save a token for a project URL

- **WHEN** a JWT is saved for project URL `https://example.form.io/myproject`
- **THEN** the file `~/.formio/mcp-tokens.json` contains `{ "https://example.form.io/myproject": "<jwt>" }`

#### Scenario: Multiple project URLs are cached independently

- **WHEN** tokens are saved for `https://a.form.io/p1` and `https://b.form.io/p2`
- **THEN** the cache file contains both entries without overwriting each other

### Requirement: Cached token can be read by project URL

The token cache module SHALL return the cached JWT for a given project URL, or `null` if no token is cached.

#### Scenario: Read an existing cached token

- **WHEN** a token was previously saved for `https://example.form.io/myproject`
- **THEN** reading the cache for that URL returns the JWT string

#### Scenario: Read a non-existent cached token

- **WHEN** no token has been cached for `https://example.form.io/other`
- **THEN** reading the cache for that URL returns `null`

#### Scenario: Cache file does not exist yet

- **WHEN** `~/.formio/mcp-tokens.json` does not exist
- **THEN** reading the cache returns `null` without throwing

### Requirement: Cached token can be cleared by project URL

The token cache module SHALL support clearing the cached token for a specific project URL without affecting other entries.

#### Scenario: Clear a cached token

- **WHEN** a token is cleared for `https://example.form.io/myproject`
- **THEN** the cache file no longer contains an entry for that URL
- **AND** other cached entries are preserved

### Requirement: Cache file has restrictive permissions

The token cache file SHALL be created with permissions `0600` (owner read/write only) to protect JWT tokens at rest.

#### Scenario: File is created with owner-only permissions

- **WHEN** the cache file is created for the first time
- **THEN** the file permissions are set to `0600`

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

### Requirement: Writes to the token cache are serialized

Every write to `~/.formio/mcp-tokens.json` — saving a token, clearing one, and `project logout` — SHALL take the cache's lock file `mcp-tokens.json.lock` under the same rules as the project map's lock (owner token, holder judgement, breaker lock, 5-second limit), read the cache afresh under the lock, apply its change, and replace the file with a temporary file renamed over it. The server's writes SHALL wait for the lock on a timer; `project logout`, which is synchronous, SHALL block. Concurrent writes for different deployments SHALL both be kept.

#### Scenario: Two processes save tokens for different deployments at once

- **WHEN** two processes each save a token for a different deployment at the same moment
- **THEN** the cache holds both tokens afterwards, and no lock file is left behind

#### Scenario: Signing out while a token is saved

- **WHEN** `project logout` removes one deployment while a server saves a token for another
- **THEN** the cache holds the saved token and not the removed one

