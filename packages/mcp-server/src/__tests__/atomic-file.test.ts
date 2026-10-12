import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeFileAtomically } from '../atomic-file.js';

// On Windows a rename over a file another process has open — an antivirus scanner, an
// indexer, a reader mid-read — fails for a moment with EPERM, EBUSY or EACCES. The
// rename is retried a few times with a short pause before the failure is reported.
describe('writeFileAtomically', () => {
  let dir: string;
  const target = () => path.join(dir, 'file.json');
  const errno = (code: string) => Object.assign(new Error(`${code}: simulated`), { code });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-atomic-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(['EPERM', 'EBUSY', 'EACCES'])('retries a rename that fails with %s', (code) => {
    const original = fs.renameSync;
    let failures = 2;
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (failures > 0) {
        failures -= 1;
        throw errno(code);
      }
      return original(from, to);
    });

    writeFileAtomically({ filePath: target(), contents: 'new' });

    expect(rename).toHaveBeenCalledTimes(3);
    expect(fs.readFileSync(target(), 'utf-8')).toBe('new');
    expect(fs.readdirSync(dir)).toEqual(['file.json']);
  });

  it('reports a rename that keeps failing, and leaves no temporary file', () => {
    fs.writeFileSync(target(), 'old');
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw errno('EBUSY');
    });

    expect(() => writeFileAtomically({ filePath: target(), contents: 'new' })).toThrow('EBUSY');

    expect(rename.mock.calls.length).toBeGreaterThan(1);
    expect(rename.mock.calls.length).toBeLessThanOrEqual(10);
    expect(fs.readFileSync(target(), 'utf-8')).toBe('old');
    expect(fs.readdirSync(dir)).toEqual(['file.json']);
  });

  it('does not retry a failure that a pause cannot clear', () => {
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw errno('EXDEV');
    });

    expect(() => writeFileAtomically({ filePath: target(), contents: 'new' })).toThrow('EXDEV');

    expect(rename).toHaveBeenCalledOnce();
  });
});
