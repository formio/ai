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
