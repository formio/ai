## ADDED Requirements

### Requirement: A CLI command signs out of a deployment

`formio-mcp project logout` SHALL remove the cached token for one deployment from `~/.formio/mcp-tokens.json`: the deployment named by `--base-url`, or else the one the directory (`--cwd`, default the current directory) resolves to. It SHALL leave every other deployment's entry intact, SHALL report which deployment it signed out of, and SHALL exit `0` when an entry was removed or none existed (saying which), `3` when the directory's deployment cannot be resolved, and `2` when the cache cannot be read or written.

#### Scenario: Sign out of the directory's deployment

- **WHEN** `formio-mcp project logout --cwd /work/app` runs and `/work/app` resolves to `https://forms.mysite.com/myproject` with a cached token
- **THEN** the token for `https://forms.mysite.com` is removed, other entries stay, and the command exits `0` naming that deployment

#### Scenario: Nothing to sign out of

- **WHEN** `formio-mcp project logout --base-url https://api.form.io` runs with no cached token for it
- **THEN** it exits `0` saying no token was cached for that deployment
