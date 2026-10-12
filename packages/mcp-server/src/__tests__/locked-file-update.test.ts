import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BLOCKING_SLEEP,
  BlockingSleep,
  DEFAULT_LOCK_TIMING,
  LockOptions,
  TIMER_SLEEP,
  errorCode,
  fingerprintOf,
  sameFingerprint,
  updateFileLocked,
  writeFileAtomically,
} from '../atomic-file.js';

type Data = Record<string, string>;

// A clock and a blocking sleep that only advances it, so a wait of seconds runs in no
// time and every judgement about elapsed time is exact.
function fakeClock() {
  const state = { now: 0, sleeps: 0 };
  const sleep: BlockingSleep = {
    kind: 'blocking',
    sleep: (ms) => {
      state.now += ms;
      state.sleeps += 1;
    },
  };
  return { state, sleep, now: () => state.now };
}

describe('updateFileLocked', () => {
  let dir: string;
  const file = () => path.join(dir, 'data.json');
  const lockFile = () => `${file()}.lock`;
  const holder = (host: string, pid: number, id = 'held') => JSON.stringify({ host, pid, id });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-locked-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const read = (): Data =>
    fs.existsSync(file()) ? (JSON.parse(fs.readFileSync(file(), 'utf-8')) as Data) : {};

  // This process is pid 100 on `this-host`; pid 200 is alive there and every other pid
  // is not.
  const request = (clock: ReturnType<typeof fakeClock>, lock: LockOptions = {}) => ({
    filePath: file(),
    read,
    update: (current: Data) => ({ next: { ...current, key: 'value' }, result: 'updated' }),
    write: (next: Data) =>
      writeFileAtomically({ filePath: file(), contents: JSON.stringify(next) }),
    lockFailure: ({ lockPath, cause }: { lockPath: string; cause: unknown }) =>
      Object.assign(new Error(`lock ${lockPath}: ${String(cause)}`), { code: 'LOCK_FAILED' }),
    lock: {
      retryMs: 10,
      timeoutMs: 1_000,
      staleMs: 300,
      hostname: 'this-host',
      pid: 100,
      isProcessAlive: (pid: number) => pid === 200,
      now: clock.now,
      ...lock,
    },
    sleep: clock.sleep,
  });

  const failureOf = (run: () => unknown): (Error & { code?: string }) | undefined => {
    try {
      run();
    } catch (error) {
      return error as Error & { code?: string };
    }
    return undefined;
  };

  it('reads under the lock, writes the change, releases the lock and returns the result', () => {
    const clock = fakeClock();
    fs.writeFileSync(file(), JSON.stringify({ other: 'kept' }));

    expect(updateFileLocked(request(clock))).toBe('updated');

    expect(read()).toEqual({ other: 'kept', key: 'value' });
    expect(fs.existsSync(lockFile())).toBe(false);
  });

  it('writes nothing when the change has nothing to write', () => {
    const clock = fakeClock();
    const write = vi.fn();

    const result = updateFileLocked({
      ...request(clock),
      update: () => ({ result: 'nothing' }),
      write,
    });

    expect(result).toBe('nothing');
    expect(write).not.toHaveBeenCalled();
    expect(fs.existsSync(lockFile())).toBe(false);
  });

  it('holds a token naming this host, this process and a unique id', () => {
    const clock = fakeClock();
    let held = '';

    updateFileLocked({
      ...request(clock, { hostname: os.hostname(), pid: process.pid }),
      update: (current: Data) => {
        held = fs.readFileSync(lockFile(), 'utf-8');
        return { next: current, result: undefined };
      },
    });

    const token = JSON.parse(held) as { host: unknown; pid: unknown; id: unknown };
    expect(token.host).toBe(os.hostname());
    expect(token.pid).toBe(process.pid);
    expect(token.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe('a lock another writer holds', () => {
    it('is never broken while its holder runs on this host, and the wait ends at its limit', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 200));
      const update = vi.fn();

      const failure = failureOf(() => updateFileLocked({ ...request(clock), update }));

      expect(failure?.code).toBe('LOCK_FAILED');
      expect(failure?.message).toContain(lockFile());
      expect(clock.state.now).toBeGreaterThanOrEqual(1_000);
      expect(update).not.toHaveBeenCalled();
      expect(fs.readFileSync(lockFile(), 'utf-8')).toBe(holder('this-host', 200));
    });

    it('is broken at once when its holder on this host has exited', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 300));

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(clock.state.sleeps).toBe(0);
      expect(fs.readdirSync(dir)).toEqual(['data.json']);
    });

    it('is broken at once when it names this very process, which holds no lock while it waits', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 100));

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(clock.state.sleeps).toBe(0);
    });

    it('from another host, is broken only once this waiter has seen it unchanged for the stale limit', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('other-host', 200));
      // Last touched an hour ago: the file's age is not what decides.
      const old = new Date(Date.now() - 3_600_000);
      fs.utimesSync(lockFile(), old, old);
      const moved: number[] = [];
      const original = fs.renameSync;
      vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
        if (from === lockFile()) {
          moved.push(clock.state.now);
        }
        return original(from, to);
      });

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(moved).toHaveLength(1);
      expect(moved[0]).toBeGreaterThanOrEqual(300);
      expect(moved[0]).toBeLessThan(1_000);
    });

    it('from another host, starts the observation again when its token changes', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('other-host', 200, 'first'));
      const moved: number[] = [];
      const original = fs.renameSync;
      vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
        if (from === lockFile()) {
          moved.push(clock.state.now);
        }
        return original(from, to);
      });
      const sleep: BlockingSleep = {
        kind: 'blocking',
        sleep: (ms) => {
          clock.sleep.sleep(ms);
          if (clock.state.now === 200) {
            fs.writeFileSync(lockFile(), holder('other-host', 200, 'second'));
          }
        },
      };

      expect(updateFileLocked({ ...request(clock), sleep })).toBe('updated');

      expect(moved).toHaveLength(1);
      expect(moved[0]).toBeGreaterThanOrEqual(500);
    });

    it('holding a token this release cannot read, is judged as one from another host', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), '12345 00000000-0000-0000-0000-000000000000');

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(clock.state.now).toBeGreaterThanOrEqual(300);
      expect(clock.state.now).toBeLessThan(1_000);
    });

    it('that keeps coming back after it is broken still ends the wait at its limit', () => {
      const clock = fakeClock();
      const original = fs.openSync;
      let attempts = 0;
      vi.spyOn(fs, 'openSync').mockImplementation((...args) => {
        if (args[0] === lockFile()) {
          attempts += 1;
          if (attempts > 10_000) {
            throw new Error('the wait never ended');
          }
          clock.state.now += 1;
          // Another holder on this host that has already exited, every time.
          fs.writeFileSync(lockFile(), holder('this-host', 300, `gone-${attempts}`));
        }
        return original(...(args as Parameters<typeof fs.openSync>));
      });

      const failure = failureOf(() => updateFileLocked(request(clock)));

      expect(failure?.code).toBe('LOCK_FAILED');
      expect(attempts).toBeLessThan(10_000);
    });
  });

  it.skipIf(process.getuid?.() === 0 || process.platform === 'win32')(
    'reports a lock it cannot create at once, without waiting, when the directory is not writable',
    () => {
      const clock = fakeClock();
      fs.chmodSync(dir, 0o500);
      try {
        const failure = failureOf(() => updateFileLocked(request(clock)));

        expect(failure?.code).toBe('LOCK_FAILED');
        expect(failure?.message).toContain('EACCES');
        expect(clock.state.sleeps).toBe(0);
      } finally {
        fs.chmodSync(dir, 0o700);
      }
    }
  );

  describe('breaking a lock', () => {
    const breaker = () => `${lockFile()}.break`;

    it('takes the breaker lock first, and releases it', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 300));
      const open = vi.spyOn(fs, 'openSync');

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(open).toHaveBeenCalledWith(breaker(), 'wx', expect.anything());
      expect(fs.readdirSync(dir)).toEqual(['data.json']);
    });

    it('waits while another writer running on this host is breaking it', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 300));
      fs.writeFileSync(breaker(), holder('this-host', 200));

      const failure = failureOf(() => updateFileLocked(request(clock)));

      expect(failure?.code).toBe('LOCK_FAILED');
      expect(fs.readFileSync(lockFile(), 'utf-8')).toBe(holder('this-host', 300));
    });

    it('clears a breaker lock its holder left behind, then breaks the lock', () => {
      const clock = fakeClock();
      fs.writeFileSync(lockFile(), holder('this-host', 300));
      fs.writeFileSync(breaker(), holder('this-host', 301));

      expect(updateFileLocked(request(clock))).toBe('updated');

      expect(fs.readdirSync(dir)).toEqual(['data.json']);
    });
  });

  describe('putting back a lock moved aside by mistake', () => {
    it('leaves the moved lock in place, named .stale, when another lock took its place, and keeps waiting', () => {
      const clock = fakeClock();
      // Judged gone: its holder on this host has exited.
      fs.writeFileSync(lockFile(), holder('this-host', 300, 'judged'));
      const originalRename = fs.renameSync;
      const originalLink = fs.linkSync;
      let raced = false;
      vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
        if (from === lockFile() && !raced) {
          raced = true;
          // Between the judgement and the move, a live writer took the lock.
          fs.rmSync(lockFile());
          fs.writeFileSync(lockFile(), holder('this-host', 200, 'moved-by-mistake'));
        }
        return originalRename(from, to);
      });
      vi.spyOn(fs, 'linkSync').mockImplementation((from, to) => {
        if (to === lockFile()) {
          // And a third writer took the empty place before it could be put back.
          fs.writeFileSync(lockFile(), holder('this-host', 200, 'third'));
        }
        return originalLink(from, to);
      });

      const failure = failureOf(() => updateFileLocked(request(clock)));

      expect(failure?.code).toBe('LOCK_FAILED');
      expect(fs.readFileSync(lockFile(), 'utf-8')).toBe(holder('this-host', 200, 'third'));
      const aside = fs.readdirSync(dir).filter((name) => name.endsWith('.stale'));
      expect(aside).toHaveLength(1);
      expect(fs.readFileSync(path.join(dir, aside[0]), 'utf-8')).toBe(
        holder('this-host', 200, 'moved-by-mistake')
      );
    });
  });

  describe('the wait', () => {
    it('blocks the thread with the blocking sleep, which the synchronous CLI uses', () => {
      expect(BLOCKING_SLEEP.kind).toBe('blocking');
      expect(TIMER_SLEEP.kind).toBe('timer');
    });

    it('with the timer sleep, leaves the event loop running while a held lock is awaited', async () => {
      fs.writeFileSync(lockFile(), holder(os.hostname(), 424_242));
      let ticks = 0;
      const ticker = setInterval(() => {
        ticks += 1;
      }, 5);
      // Released by a timer, which can fire only while the event loop runs.
      setTimeout(() => fs.rmSync(lockFile()), 60);

      try {
        const result = updateFileLocked({
          filePath: file(),
          read,
          update: (current: Data) => ({ next: { ...current, key: 'async' }, result: 'awaited' }),
          write: (next: Data) =>
            writeFileAtomically({ filePath: file(), contents: JSON.stringify(next) }),
          lockFailure: ({ cause }) => new Error(String(cause)),
          lock: { retryMs: 5, timeoutMs: 2_000, isProcessAlive: () => true },
          sleep: TIMER_SLEEP,
        });
        expect(result).toBeInstanceOf(Promise);
        expect(await result).toBe('awaited');
      } finally {
        clearInterval(ticker);
      }

      expect(ticks).toBeGreaterThan(0);
      expect(read()).toEqual({ key: 'async' });
    });

    it('defaults to 50 ms between attempts, a 3 s stale limit, and a 5 s limit', () => {
      expect(DEFAULT_LOCK_TIMING).toEqual({ retryMs: 50, timeoutMs: 5_000, staleMs: 3_000 });
    });
  });
});

// One copy of the file-identity and errno helpers, shared by every reader of a file
// that is replaced by rename.
describe('shared file helpers', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-fingerprint-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('errorCode reads the code of a filesystem error, and nothing from anything else', () => {
    expect(errorCode(Object.assign(new Error('x'), { code: 'ENOENT' }))).toBe('ENOENT');
    expect(errorCode(new Error('plain'))).toBeUndefined();
    expect(errorCode('ENOENT')).toBeUndefined();
  });

  it('fingerprintOf reports a missing file, and a file by modification time, size and inode', () => {
    const file = path.join(dir, 'f.json');
    expect(fingerprintOf(file)).toBe('missing');
    fs.writeFileSync(file, 'one');
    const first = fingerprintOf(file);
    expect(first).toMatchObject({ size: 3 });
    writeFileAtomically({ filePath: file, contents: 'two' });
    const second = fingerprintOf(file);
    expect(first !== undefined && second !== undefined && sameFingerprint(first, second)).toBe(
      false
    );
    expect(second !== undefined && sameFingerprint(second, second)).toBe(true);
    expect(sameFingerprint('missing', 'missing')).toBe(true);
  });

  it.each(['project-map.ts', 'token-cache.ts'])('%s does not keep its own copy', (name) => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', name), 'utf-8');
    expect(source).not.toMatch(
      /function fingerprintOf|const sameFingerprint|interface \w*Fingerprint/
    );
    expect(source).not.toMatch(/function errorCode|const isMissing/);
  });
});
