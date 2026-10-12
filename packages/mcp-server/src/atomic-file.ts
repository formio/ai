import fs from 'fs';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { pauseSync } from './sync-pause.js';
import { isRecord } from './tool-errors.js';

export interface AtomicWrite {
  filePath: string;
  contents: string;
}

/** The code a filesystem call failed with, or undefined for anything else. */
export const errorCode = (error: unknown): string | undefined =>
  error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;

/** What identifies one version of a file without reading it. */
export interface FileFingerprint {
  mtimeMs: number;
  size: number;
  ino: number;
}

/** A file's fingerprint, or 'missing' when there is no file. */
export type FingerprintState = FileFingerprint | 'missing';

/**
 * A file's modification time, size and inode — every write here renames a new file into
 * place, so a write always changes the inode — or 'missing' when there is no file, or
 * undefined when it could not even be stat'd.
 */
export function fingerprintOf(filePath: string): FingerprintState | undefined {
  try {
    const { mtimeMs, size, ino } = fs.statSync(filePath);
    return { mtimeMs, size, ino };
  } catch (error) {
    return errorCode(error) === 'ENOENT' ? 'missing' : undefined;
  }
}

export const sameFingerprint = (a: FingerprintState, b: FingerprintState): boolean =>
  a === 'missing' || b === 'missing'
    ? a === b
    : a.mtimeMs === b.mtimeMs && a.size === b.size && a.ino === b.ino;

// Codes a rename over a file returns on Windows while another process briefly has the
// target open — an antivirus scanner, a search indexer, a reader mid-read. Each clears
// on its own within milliseconds.
const TRANSIENT_RENAME_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 5;
const RENAME_BACKOFF_MS = 20;

/** Whether a failure is one a short pause can clear on Windows. */
export const isTransientFileError = (error: unknown): boolean =>
  TRANSIENT_RENAME_CODES.has(errorCode(error) ?? '');

export interface RenameRequest {
  from: string;
  to: string;
  attempt?: number;
}

/**
 * A rename, retried with a growing pause while the failure is one Windows clears on its
 * own (EPERM, EBUSY, EACCES). Anything else, or the last attempt's failure, is rethrown
 * as it came.
 */
export function renameWithRetry({ from, to, attempt = 1 }: RenameRequest): void {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (attempt >= RENAME_ATTEMPTS || !isTransientFileError(error)) {
      throw error;
    }
    pauseSync(RENAME_BACKOFF_MS * attempt);
    renameWithRetry({ from, to, attempt: attempt + 1 });
  }
}

/**
 * Replace a file in one step: write a temporary file in the same directory, created
 * 0600, and rename it over the target. A rename within a directory replaces the file
 * atomically, so a concurrent reader — another server, or the CLI — sees the old file
 * or the new one, never a partial one. A rename that fails with EPERM, EBUSY or EACCES
 * is retried a few times first. The temporary file is removed when any step fails, and
 * the failure is rethrown for the caller to name its own file.
 */
export function writeFileAtomically({ filePath, contents }: AtomicWrite): void {
  const directory = path.dirname(filePath);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporary, contents, { mode: 0o600, flag: 'wx' });
    renameWithRetry({ from: temporary, to: filePath });
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * How a writer waits between attempts to take a lock. The CLI is synchronous throughout
 * and blocks its thread; the MCP server waits on a timer, so its event loop keeps
 * serving while another writer holds the lock.
 */
export interface BlockingSleep {
  readonly kind: 'blocking';
  readonly sleep: (ms: number) => void;
}

export interface TimerSleep {
  readonly kind: 'timer';
  readonly sleep: (ms: number) => Promise<void>;
}

export type SleepStrategy = BlockingSleep | TimerSleep;

export const BLOCKING_SLEEP: BlockingSleep = { kind: 'blocking', sleep: pauseSync };

export const TIMER_SLEEP: TimerSleep = {
  kind: 'timer',
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * How a writer waits for a lock: it retries every `retryMs` and gives up after
 * `timeoutMs`. A lock held by another host is judged abandoned once this writer has
 * seen it unchanged for `staleMs`, which is below `timeoutMs` so the judgement lands
 * within one wait. A write holds the lock for milliseconds.
 */
export interface LockTiming {
  retryMs: number;
  timeoutMs: number;
  staleMs: number;
}

export const DEFAULT_LOCK_TIMING: LockTiming = {
  retryMs: 50,
  timeoutMs: 5_000,
  staleMs: 3_000,
};

/** Who this writer is, and how it judges another holder; replaced in tests. */
export interface LockHolderChecks {
  hostname: string;
  pid: number;
  isProcessAlive: (pid: number) => boolean;
  /** A monotonic clock in milliseconds. */
  now: () => number;
}

export type LockOptions = Partial<LockTiming & LockHolderChecks>;

// `kill(pid, 0)` delivers nothing; it reports whether the process exists. EPERM means it
// exists and belongs to another user.
const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === 'EPERM';
  }
};

const defaultChecks = (): LockHolderChecks => ({
  hostname: os.hostname(),
  pid: process.pid,
  isProcessAlive,
  now: () => performance.now(),
});

/** What a lock file says about its holder. */
interface LockHolder {
  host: string;
  pid: number;
  id: string;
}

function holderOf(raw: string): LockHolder | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) &&
      typeof parsed.host === 'string' &&
      typeof parsed.pid === 'number' &&
      typeof parsed.id === 'string'
      ? { host: parsed.host, pid: parsed.pid, id: parsed.id }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The lock's contents, or undefined when there is no lock. */
function readLock(lockPath: string): string | undefined {
  try {
    return fs.readFileSync(lockPath, 'utf-8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

// True when this call created the lock file, holding `owner`; false when a lock is
// already there. EPERM counts as held: Windows returns it for an exclusive create of a
// file that another process is still deleting.
function createLock(lockPath: string, owner: string): boolean {
  let fd: number;
  try {
    fd = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (errorCode(error) === 'EEXIST' || errorCode(error) === 'EPERM') {
      return false;
    }
    throw error;
  }
  try {
    fs.writeSync(fd, owner);
  } finally {
    fs.closeSync(fd);
  }
  return true;
}

interface Observation {
  raw: string;
  since: number;
}

interface HolderJudgement {
  observed: Observation;
  checks: LockHolderChecks;
  timing: LockTiming;
}

/**
 * Whether the lock's holder is gone.
 *
 * - A holder on this host is asked for directly: a running process is never broken,
 *   however long it holds the lock, and one that has exited is gone at once. A lock
 *   naming this very process is one it left behind, since a writer holds no lock while
 *   it waits for one.
 * - A holder on another host cannot be asked, and neither can a token this release
 *   cannot read: it is gone once this writer has seen the same token for `staleMs`,
 *   measured on its own monotonic clock — another host's clock, or a file time it set,
 *   says nothing here.
 */
function holderIsGone({ observed, checks, timing }: HolderJudgement): boolean {
  const holder = holderOf(observed.raw);
  if (holder !== undefined && holder.host === checks.hostname) {
    return holder.pid === checks.pid || !checks.isProcessAlive(holder.pid);
  }
  return checks.now() - observed.since >= timing.staleMs;
}

interface SetAside {
  lockPath: string;
  /** The lock that was judged gone, exactly as it was read. */
  judged: string;
}

/**
 * Remove a lock whose holder is gone: move it aside under a unique name, then remove it
 * if it is the lock that was judged, or put it back.
 *
 * Called only under the breaker lock (see breakLock), so no other waiter is removing
 * locks meanwhile; moving before removing covers the one writer that still can — a
 * holder judged gone that releases its own lock between this look and this move, after
 * which another writer may take the place. That writer's lock is linked back into
 * place. If yet another writer took the place meanwhile, its lock stands and the moved
 * one is left where it is, named `.stale`, rather than deleted.
 */
function setLockAside({ lockPath, judged }: SetAside): void {
  if (readLock(lockPath) !== judged) {
    return;
  }
  const aside = `${lockPath}.${randomUUID()}.stale`;
  try {
    renameWithRetry({ from: lockPath, to: aside });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return;
    }
    throw error;
  }
  if (readLock(aside) === judged) {
    fs.rmSync(aside, { force: true, maxRetries: 3 });
    return;
  }
  putBack({ aside, lockPath });
}

function putBack({ aside, lockPath }: { aside: string; lockPath: string }): void {
  try {
    fs.linkSync(aside, lockPath);
  } catch (error) {
    if (errorCode(error) === 'EEXIST') {
      return;
    }
    // A filesystem without hard links: move it back instead.
    renameWithRetry({ from: aside, to: lockPath });
    return;
  }
  fs.rmSync(aside, { force: true, maxRetries: 3 });
}

const breakerPathOf = (lockPath: string): string => `${lockPath}.break`;

interface BreakRequest extends SetAside {
  owner: string;
}

/**
 * Break a lock whose holder is gone, holding the breaker lock — `<lock>.break`, taken by
 * exclusive create like the lock itself — while doing it. Only the writer holding it
 * removes a lock it did not take, so two waiters that judged the same lock gone cannot
 * each remove it in turn, the second removing the lock the first then took. Returns
 * false, leaving the lock alone, when another writer holds the breaker lock.
 */
function breakLock({ lockPath, judged, owner }: BreakRequest): boolean {
  const breaker = breakerPathOf(lockPath);
  if (!createLock(breaker, owner)) {
    return false;
  }
  try {
    setLockAside({ lockPath, judged });
  } finally {
    releaseLock({ lockPath: breaker, owner });
  }
  return true;
}

/** What a waiter has seen of the lock, and of the breaker lock, and since when. */
interface Watch {
  lock?: Observation;
  breaker?: Observation;
}

// The same token keeps the time it was first seen; a different one starts afresh.
const observe = (
  previous: Observation | undefined,
  raw: string | undefined,
  now: number
): Observation | undefined =>
  raw === undefined ? undefined : previous?.raw === raw ? previous : { raw, since: now };

interface Pass {
  /** The lock's token when this pass took it. */
  owner?: string;
  watch: Watch;
  /** Whether a lock was removed, so the next pass need not wait. */
  retryAtOnce: boolean;
}

interface PassRequest {
  lockPath: string;
  owner: string;
  watch: Watch;
  checks: LockHolderChecks;
  timing: LockTiming;
}

/**
 * One attempt: take the lock; or, when its holder is gone, break it; or, when the
 * breaker lock's own holder is gone — it stopped between taking and releasing it — clear
 * that, by the same judgement.
 */
function attemptLock({ lockPath, owner, watch, checks, timing }: PassRequest): Pass {
  if (createLock(lockPath, owner)) {
    return { owner, watch: {}, retryAtOnce: false };
  }
  const lock = observe(watch.lock, readLock(lockPath), checks.now());
  if (lock === undefined || !holderIsGone({ observed: lock, checks, timing })) {
    return { watch: { lock }, retryAtOnce: false };
  }
  if (breakLock({ lockPath, judged: lock.raw, owner })) {
    return { watch: {}, retryAtOnce: true };
  }
  const breakerPath = breakerPathOf(lockPath);
  const breaker = observe(watch.breaker, readLock(breakerPath), checks.now());
  if (breaker === undefined || !holderIsGone({ observed: breaker, checks, timing })) {
    return { watch: { lock, breaker }, retryAtOnce: false };
  }
  if (readLock(breakerPath) === breaker.raw) {
    fs.rmSync(breakerPath, { force: true, maxRetries: 3 });
  }
  return { watch: { lock }, retryAtOnce: true };
}

interface LockRequest {
  lockPath: string;
  timing: LockTiming;
  checks: LockHolderChecks;
  failure: (cause: unknown) => Error;
}

/**
 * Take a lock by creating its lock file exclusively, and return the token written into
 * it. Exclusive create is the one primitive every platform gives Node without a native
 * addon: it either creates the file or fails because it exists.
 *
 * Yields each pause it needs, in milliseconds, so one copy of this logic serves the
 * blocking wait and the timer wait (see driveBlocking / driveTimer). Every pass checks
 * the deadline, including a pass that just broke a lock.
 */
function* acquireLock({
  lockPath,
  timing,
  checks,
  failure,
}: LockRequest): Generator<number, string, void> {
  const owner = JSON.stringify({ host: checks.hostname, pid: checks.pid, id: randomUUID() });
  const deadline = checks.now() + timing.timeoutMs;
  let pass: Pass = { watch: {}, retryAtOnce: false };
  for (;;) {
    try {
      pass = attemptLock({ lockPath, owner, watch: pass.watch, checks, timing });
      if (pass.owner !== undefined) {
        return pass.owner;
      }
    } catch (error) {
      // A file Windows kept refusing to create, move or read is retried on the next
      // pass, like a held lock. Elsewhere those codes mean the directory is not
      // writable, which no wait changes, so they are reported at once.
      if (!(process.platform === 'win32' && isTransientFileError(error))) {
        throw failure(error);
      }
      pass = { watch: pass.watch, retryAtOnce: false };
    }
    if (checks.now() >= deadline) {
      throw failure(new Error(`another writer held it for more than ${timing.timeoutMs / 1000} s`));
    }
    if (!pass.retryAtOnce) {
      yield timing.retryMs;
    }
  }
}

/**
 * Release the lock if this writer still owns it. A lock that is not this writer's —
 * because its own was judged abandoned and another writer took the place — is left
 * alone.
 */
function releaseLock({ lockPath, owner }: { lockPath: string; owner: string }): void {
  try {
    if (readLock(lockPath) === owner) {
      fs.rmSync(lockPath, { force: true, maxRetries: 3 });
    }
  } catch {
    // Left in place, it is judged by its holder like any other; the write has landed.
  }
}

/** What a locked update does with the data it read. `next` absent writes nothing. */
export interface LockedChange<D, T> {
  next?: D;
  result: T;
}

export interface LockedFileUpdate<D, T> {
  /** The file being updated. Its lock is the same path with `.lock` appended. */
  filePath: string;
  /** Reads the file afresh; called only under the lock. */
  read: () => D;
  update: (current: D) => LockedChange<D, T>;
  write: (next: D) => void;
  /** The error a lock that cannot be taken is reported as, in the caller's terms. */
  lockFailure: (failure: { lockPath: string; cause: unknown }) => Error;
  lock?: LockOptions;
}

function* lockedUpdate<D, T>({
  filePath,
  read,
  update,
  write,
  lockFailure,
  lock = {},
}: LockedFileUpdate<D, T>): Generator<number, T, void> {
  const lockPath = `${filePath}.lock`;
  const { retryMs, timeoutMs, staleMs, ...checks } = {
    ...DEFAULT_LOCK_TIMING,
    ...defaultChecks(),
    ...lock,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const owner = yield* acquireLock({
    lockPath,
    timing: { retryMs, timeoutMs, staleMs },
    checks,
    failure: (cause) => lockFailure({ lockPath, cause }),
  });
  try {
    const { next, result } = update(read());
    if (next !== undefined) {
      write(next);
    }
    return result;
  } finally {
    releaseLock({ lockPath, owner });
  }
}

function driveBlocking<T>(steps: Generator<number, T, void>, sleep: BlockingSleep): T {
  for (let step = steps.next(); ; step = steps.next()) {
    if (step.done) {
      return step.value;
    }
    sleep.sleep(step.value);
  }
}

async function driveTimer<T>(steps: Generator<number, T, void>, sleep: TimerSleep): Promise<T> {
  for (let step = steps.next(); ; step = steps.next()) {
    if (step.done) {
      return step.value;
    }
    await sleep.sleep(step.value);
  }
}

/**
 * The one locked read-modify-write for a file several processes share.
 *
 * Takes the file's lock, reads the file afresh under it — never a copy read before the
 * lock — applies the change, writes the result when there is one, and releases the lock
 * whatever happens, if this writer still owns it. The read, the change and the write
 * run without pausing, so a lock is held for milliseconds and never across a wait.
 *
 * `sleep` decides how the wait for a held lock passes: BLOCKING_SLEEP (the default)
 * returns the result, TIMER_SLEEP returns a promise of it and leaves the event loop
 * running meanwhile.
 */
export function updateFileLocked<D, T>(
  request: LockedFileUpdate<D, T> & { sleep?: BlockingSleep }
): T;
export function updateFileLocked<D, T>(
  request: LockedFileUpdate<D, T> & { sleep: TimerSleep }
): Promise<T>;
export function updateFileLocked<D, T>(
  request: LockedFileUpdate<D, T> & { sleep?: SleepStrategy }
): T | Promise<T>;
export function updateFileLocked<D, T>({
  sleep = BLOCKING_SLEEP,
  ...request
}: LockedFileUpdate<D, T> & { sleep?: SleepStrategy }): T | Promise<T> {
  const steps = lockedUpdate(request);
  return sleep.kind === 'timer' ? driveTimer(steps, sleep) : driveBlocking(steps, sleep);
}
