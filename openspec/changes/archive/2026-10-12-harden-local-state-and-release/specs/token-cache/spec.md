## ADDED Requirements

### Requirement: Writes to the token cache are serialized

Every write to `~/.formio/mcp-tokens.json` — saving a token, clearing one, and `project logout` — SHALL take the cache's lock file `mcp-tokens.json.lock` under the same rules as the project map's lock (owner token, holder judgement, breaker lock, 5-second limit), read the cache afresh under the lock, apply its change, and replace the file with a temporary file renamed over it. The server's writes SHALL wait for the lock on a timer; `project logout`, which is synchronous, SHALL block. Concurrent writes for different deployments SHALL both be kept.

#### Scenario: Two processes save tokens for different deployments at once

- **WHEN** two processes each save a token for a different deployment at the same moment
- **THEN** the cache holds both tokens afterwards, and no lock file is left behind

#### Scenario: Signing out while a token is saved

- **WHEN** `project logout` removes one deployment while a server saves a token for another
- **THEN** the cache holds the saved token and not the removed one
