## ADDED Requirements

### Requirement: Writes to the project map are atomic and serialized

Every write to `~/.formio/projects.json` SHALL take an exclusive lock file beside it (created with exclusive-create semantics) holding an owner token unique to that acquisition (the process id and a random UUID), re-read the map under the lock, apply its own change, write the result to a temporary file in the same directory with mode `0600`, rename it over the map, and release the lock. A writer SHALL remove the lock on release only while the lock still holds its own token. A lock last modified more than 3 seconds ago SHALL be treated as abandoned and broken by renaming it to a unique `projects.json.lock.<uuid>.stale` name and then removing that file; a writer whose rename finds no lock SHALL go back to acquiring, and a writer whose renamed file is not the lock it judged abandoned SHALL put that lock back. A writer that cannot take the lock within 5 seconds SHALL fail with code `CONFIG_UNREADABLE` naming the lock file. A reader SHALL never observe a partially written map, and concurrent writers for different directories SHALL both be kept.

#### Scenario: Two processes map different directories at once

- **WHEN** two server processes each record a mapping for a different directory at the same moment
- **THEN** the map holds both entries afterwards

#### Scenario: A reader during a write

- **WHEN** a process reads the map while another is writing it
- **THEN** it reads either the previous complete map or the new complete map

#### Scenario: An abandoned lock

- **WHEN** a lock file older than 3 seconds is present and a write starts
- **THEN** the write renames that lock aside, removes it, takes a lock of its own, and proceeds

#### Scenario: A crashed writer's lock

- **WHEN** a writer exits while holding the lock and another write starts at once
- **THEN** the waiting write breaks the lock once it is older than 3 seconds and completes within its 5-second wait

#### Scenario: Several writers meet one abandoned lock

- **WHEN** several processes find the same abandoned lock at the same moment
- **THEN** one of them breaks it, the others find it gone and wait for the lock in turn, and every entry each of them writes is kept

#### Scenario: A writer that outlived the stale limit

- **WHEN** a writer holds the lock longer than 3 seconds and another writer breaks it and takes its own
- **THEN** the first writer's release leaves the second writer's lock in place

### Requirement: Map writes tolerate transient Windows file errors

The rename of the temporary file over the map SHALL be retried a few times, with a short pause between attempts, when it fails with `EPERM`, `EBUSY` or `EACCES`; any other failure, or the last attempt's, SHALL be reported. An exclusive create of the lock file that fails with `EPERM` SHALL be treated as a held lock and retried within the wait.

#### Scenario: A rename refused for a moment

- **WHEN** the rename over the map fails with `EBUSY` twice and then succeeds
- **THEN** the write completes with the new map

#### Scenario: A lock file still being deleted

- **WHEN** the exclusive create of the lock file fails once with `EPERM`
- **THEN** the writer retries and the write completes

### Requirement: A mapping applies to its directory's descendants within a repository, compared by canonical path

Reading the map for a directory SHALL use the entry for the nearest ancestor-or-self directory that has one. The walk SHALL stop at the first directory, the start included, that contains `.git` — the boundary of the committed `formio.json` walk — so a mapping recorded above that directory SHALL NOT apply; without any `.git` the walk SHALL run to the filesystem root. Directories SHALL be compared by canonical path: the real path of the part that exists (symbolic links resolved, and the case the filesystem stores), compared exactly. Only a stored directory that no longer exists SHALL be compared case-insensitively, and only on macOS and Windows. On Windows a path of the form `/c/...` SHALL be read as `C:\...`. Entries already in the map SHALL be matched as they are, without rewriting the file. A write SHALL record the entry for the canonical form of the directory it was given, replacing only entries that name the same directory under those rules. The precedence between a committed `formio.json`, a mapping, and the environment is unchanged.

#### Scenario: A subdirectory of a mapped repository

- **WHEN** `/work/repo` contains `.git` and is mapped, and a tool resolves for `/work/repo/apps/web`, which has no mapping and no committed file
- **THEN** the project mapped for `/work/repo` resolves

#### Scenario: A mapping above a repository

- **WHEN** `/home/me/code` is mapped and a tool resolves for `/home/me/code/other-repo`, which contains `.git` and has no mapping of its own
- **THEN** no mapping applies and the directory is reported as not configured

#### Scenario: The nearer mapping wins

- **WHEN** both `/work/repo` and `/work/repo/apps/web` are mapped to different projects
- **THEN** a tool resolving for `/work/repo/apps/web/src` gets the project mapped for `/work/repo/apps/web`

#### Scenario: A symlinked path

- **WHEN** `/private/tmp/app` is mapped on macOS and a tool resolves for `/tmp/app`
- **THEN** the mapping for `/private/tmp/app` applies

#### Scenario: Case on Windows

- **WHEN** `C:\Users\Me\app` is mapped and a tool resolves for `c:\users\me\app`
- **THEN** the mapping applies

#### Scenario: Two directories differing only by case on a case-sensitive volume

- **WHEN** `/vol/Foo` and `/vol/foo` both exist on a case-sensitive volume and each is mapped to a different project
- **THEN** each resolves its own project, and writing one leaves the other's entry in place

#### Scenario: A mapped directory that no longer exists

- **WHEN** `/vol/FOO` is mapped on macOS, no longer exists, and a tool resolves for `/vol/foo/src`
- **THEN** the mapping for `/vol/FOO` applies

### Requirement: Map reads reuse the parsed map until the file changes

A reader SHALL keep the parsed map and the comparison index of its stored directories keyed by the map file's modification time, size and inode, and SHALL reuse them while those are unchanged, reading and indexing the file again when any of them changes. A write SHALL always read the map afresh under the lock.

#### Scenario: An unchanged map

- **WHEN** two lookups run and the map file has not changed between them
- **THEN** the second neither reads the file nor resolves the stored directories again

#### Scenario: A changed map

- **WHEN** the map file is replaced between two lookups
- **THEN** the second reads and indexes the new file

### Requirement: Restating an inherited pair changes nothing

When the record that governs a directory is a mapping inherited from an ancestor directory, a `project_set` call or `project set` command for that directory whose resulting pair equals the inherited pair SHALL write nothing and SHALL report no change, naming the ancestor whose mapping supplies the pair. A pair that differs SHALL be recorded as the directory's own entry. A child entry SHALL carry the `forced` flag only when `project set --force` was given for that directory; the flag of an ancestor's entry SHALL NOT be copied onto it.

#### Scenario: The project an ancestor maps

- **WHEN** `/work/repo` is mapped to `https://repo.form.io` on `https://api.form.io` and `project_set` is called for `/work/repo/apps/web` with `projectUrl` `https://repo.form.io`
- **THEN** nothing is written, the result reports no change, and its message names `/work/repo` as the mapping the pair is inherited from

#### Scenario: A forced ancestor

- **WHEN** `/work/repo` holds a forced pair and `project set` restates that pair for `/work/repo/apps/web` without `--force`
- **THEN** nothing is written and no forced entry is recorded for `/work/repo/apps/web`

#### Scenario: A different project beneath a mapped ancestor

- **WHEN** `/work/repo` is mapped and `project set` records a different project for `/work/repo/apps/web`
- **THEN** `/work/repo/apps/web` gets its own entry and the ancestor's entry is unchanged
