## ADDED Requirements

### Requirement: Writes to the project map are atomic and serialized

Every write to `~/.formio/projects.json` SHALL take an exclusive lock file beside it, `projects.json.lock`, created with exclusive-create semantics and holding an owner token unique to that acquisition — JSON naming the host (`os.hostname()`), the process id and a random UUID — then re-read the map under the lock, apply its own change, write the result to a temporary file in the same directory with mode `0600`, rename it over the map, and release the lock. A writer SHALL remove the lock on release only while the lock still holds its own token.

Whether a lock another writer holds is abandoned SHALL be decided from its token, never from the file's modification time:

- A lock naming this host and a process that is running (`process.kill(pid, 0)` succeeds or fails with `EPERM`) SHALL NOT be broken, however long it is held; a waiter SHALL wait until its limit and then fail.
- A lock naming this host and a process that has exited, or the waiting process itself, SHALL be abandoned at once.
- A lock naming another host, or holding a token that cannot be read, SHALL be abandoned only once the waiter has seen the same token unchanged for 3 seconds, measured on its own monotonic clock (`performance.now()`).

An abandoned lock SHALL be broken only by the writer holding the breaker lock `projects.json.lock.break`, taken with exclusive create and holding that writer's token; a waiter that cannot take it SHALL go back to waiting, and a breaker lock whose holder is gone by the same rules SHALL be removed. Holding it, the writer SHALL re-read the lock, and only when it is still the token judged abandoned move it to a unique `projects.json.lock.<uuid>.stale` name; it SHALL remove the moved file when it holds the judged token, and otherwise link it back into place. When another lock has taken the place meanwhile (the link fails with `EEXIST`), the moved file SHALL be left in place under its `.stale` name and the writer SHALL go back to waiting.

Every attempt SHALL check the waiter's deadline, an attempt that broke a lock included. A writer that cannot take the lock within 5 seconds SHALL fail with code `CONFIG_UNREADABLE` naming the lock file. A wait SHALL block the thread in `project set`, which is synchronous, and SHALL pass on a timer in the MCP server, whose event loop keeps running meanwhile. A reader SHALL never observe a partially written map, and concurrent writers for different directories SHALL both be kept.

#### Scenario: Two processes map different directories at once

- **WHEN** two server processes each record a mapping for a different directory at the same moment
- **THEN** the map holds both entries afterwards

#### Scenario: A reader during a write

- **WHEN** a process reads the map while another is writing it
- **THEN** it reads either the previous complete map or the new complete map

#### Scenario: A running holder on this host

- **WHEN** the lock names this host and a process that is running, and a write starts
- **THEN** the lock is left in place and the write fails with `CONFIG_UNREADABLE` after 5 seconds

#### Scenario: A crashed writer's lock

- **WHEN** a writer on this host exits while holding the lock and another write starts at once
- **THEN** the waiting write breaks the lock at once and completes

#### Scenario: A lock from another host

- **WHEN** the lock names another host and a write starts
- **THEN** the write breaks it once it has seen that token unchanged for 3 seconds, whatever the file's modification time, and a token that changes meanwhile starts the 3 seconds again

#### Scenario: Several writers meet one abandoned lock

- **WHEN** several processes find the same abandoned lock at the same moment
- **THEN** only the one holding the breaker lock breaks it, the others wait for the lock in turn, and every entry each of them writes is kept

#### Scenario: A lock that keeps coming back

- **WHEN** every lock a waiter breaks is replaced by another abandoned one
- **THEN** the waiter still fails at its 5-second limit

#### Scenario: A lock put back over another

- **WHEN** a breaker moves a lock that is not the one it judged, and another lock has taken the place before it can be linked back
- **THEN** the moved lock is left under its `.stale` name, the other lock stands, and the breaker keeps waiting

#### Scenario: project_set waiting for the lock

- **WHEN** `project_set` waits for a lock a running process on this host holds, and that process releases it
- **THEN** the server's event loop keeps running during the wait, and the write completes once the lock is free

### Requirement: Map writes tolerate transient Windows file errors

The rename of the temporary file over the map SHALL be retried a few times, with a short pause between attempts, when it fails with `EPERM`, `EBUSY` or `EACCES`; any other failure, or the last attempt's, SHALL be reported. An exclusive create of the lock file that fails with `EPERM` SHALL be treated as a held lock and retried within the wait. Any other `EPERM`, `EBUSY` or `EACCES` while taking the lock SHALL be retried within the wait on Windows and reported at once elsewhere, where it means the directory cannot be written.

#### Scenario: A rename refused for a moment

- **WHEN** the rename over the map fails with `EBUSY` twice and then succeeds
- **THEN** the write completes with the new map

#### Scenario: A directory that cannot be written

- **WHEN** the lock file cannot be created because `~/.formio` is not writable, on a platform other than Windows
- **THEN** the write fails at once, naming the lock file, without waiting out the 5 seconds

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

When the record that governs a directory is a mapping inherited from an ancestor directory, a `project_set` call or `project set` command for that directory whose resulting pair equals the inherited pair SHALL write nothing and SHALL report no change, naming the ancestor whose mapping supplies the pair. A pair that differs SHALL be recorded as the directory's own entry. A child entry SHALL carry the `forced` flag only when `project set --force` was given for that directory; the flag of an ancestor's entry SHALL NOT be copied onto it. `project set --force` for a directory SHALL record that directory's own forced entry even when the pair equals a forced pair it inherits.

#### Scenario: The project an ancestor maps

- **WHEN** `/work/repo` is mapped to `https://repo.form.io` on `https://api.form.io` and `project_set` is called for `/work/repo/apps/web` with `projectUrl` `https://repo.form.io`
- **THEN** nothing is written, the result reports no change, and its message names `/work/repo` as the mapping the pair is inherited from

#### Scenario: A forced ancestor

- **WHEN** `/work/repo` holds a forced pair and `project set` restates that pair for `/work/repo/apps/web` without `--force`
- **THEN** nothing is written and no forced entry is recorded for `/work/repo/apps/web`

#### Scenario: Forcing the inherited pair for a child

- **WHEN** `/work/repo` holds a forced pair and `project set --force` states that same pair for `/work/repo/apps/web`
- **THEN** `/work/repo/apps/web` gets its own forced entry and the ancestor's entry is unchanged

#### Scenario: A different project beneath a mapped ancestor

- **WHEN** `/work/repo` is mapped and `project set` records a different project for `/work/repo/apps/web`
- **THEN** `/work/repo/apps/web` gets its own entry and the ancestor's entry is unchanged

### Requirement: A remedy about an inherited mapping names the directory that holds it

When the mapping that governs a directory is inherited from an ancestor, a message that tells the caller to clear or replace that mapping SHALL name the ancestor directory it is recorded for, not the directory the call was for. `project set --reset` for a directory with no entry of its own that inherits one SHALL clear nothing, SHALL say that the directory inherits the mapping recorded for the ancestor and that resetting it is run there — naming `project set --reset --cwd <ancestor>` — and SHALL exit as it does when there is nothing to clear. A `project_set` call or `project set` command refused because the inherited entry cannot answer with a project SHALL name the ancestor as the directory to record the replacement for.

#### Scenario: Resetting beneath a mapped ancestor

- **WHEN** `/work/repo` is mapped and `project set --reset` is run for `/work/repo/apps/web`, which has no entry of its own
- **THEN** nothing is cleared, the command exits 0, and its output says `/work/repo/apps/web` inherits the mapping recorded for `/work/repo` and names `project set --reset --cwd /work/repo`

#### Scenario: An inherited entry that cannot answer

- **WHEN** `/work/repo`'s entry holds a project URL that is not a URL and `project_set` is called for `/work/repo/apps/web` with `baseUrl` alone
- **THEN** the call is refused and its remedy names `/work/repo` as the directory to record the project for
