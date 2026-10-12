## ADDED Requirements

### Requirement: Writes to the project map are atomic and serialized

Every write to `~/.formio/projects.json` SHALL take an exclusive lock file beside it (created with exclusive-create semantics), re-read the map under the lock, apply its own change, write the result to a temporary file in the same directory with mode `0600`, rename it over the map, and release the lock. A lock older than 10 seconds SHALL be treated as abandoned and replaced. A writer that cannot take the lock within 5 seconds SHALL fail with code `CONFIG_UNREADABLE` naming the lock file. A reader SHALL never observe a partially written map, and concurrent writers for different directories SHALL both be kept.

#### Scenario: Two processes map different directories at once

- **WHEN** two server processes each record a mapping for a different directory at the same moment
- **THEN** the map holds both entries afterwards

#### Scenario: A reader during a write

- **WHEN** a process reads the map while another is writing it
- **THEN** it reads either the previous complete map or the new complete map

#### Scenario: An abandoned lock

- **WHEN** a lock file older than 10 seconds is present and a write starts
- **THEN** the write replaces the lock and proceeds

### Requirement: A mapping applies to its directory's descendants, compared by canonical path

Reading the map for a directory SHALL use the entry for the nearest ancestor-or-self directory that has one. Directories SHALL be compared by canonical path: symbolic links resolved where the path exists, and compared case-insensitively on macOS and Windows. On Windows a path of the form `/c/...` SHALL be read as `C:\...`. Entries already in the map SHALL be matched as they are, without rewriting the file. A write SHALL record the entry for the canonical form of the directory it was given. The precedence between a committed `formio.json`, a mapping, and the environment is unchanged.

#### Scenario: A subdirectory of a mapped repository

- **WHEN** `/work/repo` is mapped and a tool resolves for `/work/repo/apps/web`, which has no mapping and no committed file
- **THEN** the project mapped for `/work/repo` resolves

#### Scenario: The nearer mapping wins

- **WHEN** both `/work/repo` and `/work/repo/apps/web` are mapped to different projects
- **THEN** a tool resolving for `/work/repo/apps/web/src` gets the project mapped for `/work/repo/apps/web`

#### Scenario: A symlinked path

- **WHEN** `/private/tmp/app` is mapped on macOS and a tool resolves for `/tmp/app`
- **THEN** the mapping for `/private/tmp/app` applies

#### Scenario: Case on Windows

- **WHEN** `C:\Users\Me\app` is mapped and a tool resolves for `c:\users\me\app`
- **THEN** the mapping applies
