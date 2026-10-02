import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getOrCreateKey,
  sessionLabel,
  SubmissionKeyStoreUnreadableError,
} from '../submission-keys.js';

const STORE_FILE = 'mcp-submission-keys.json';

describe('submission signing key store', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-submission-keys-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('creates a 32-byte key on first use, writes the store 0600, and returns the same key after', () => {
    const first = getOrCreateKey({ cwd: '/work/app', cacheDir });
    expect(first).toBeInstanceOf(Buffer);
    expect(first.length).toBe(32);

    const storePath = path.join(cacheDir, STORE_FILE);
    expect(fs.statSync(storePath).mode & 0o777).toBe(0o600);

    const second = getOrCreateKey({ cwd: '/work/app', cacheDir });
    expect(second.equals(first)).toBe(true);
  });

  it('gives each working directory its own key', () => {
    const a = getOrCreateKey({ cwd: '/work/a', cacheDir });
    const b = getOrCreateKey({ cwd: '/work/b', cacheDir });
    expect(a.equals(b)).toBe(false);
  });

  it('keys directories the way the project map does, so a trailing slash is the same directory', () => {
    const plain = getOrCreateKey({ cwd: '/work/app', cacheDir });
    const slashed = getOrCreateKey({ cwd: '/work/app/', cacheDir });
    expect(slashed.equals(plain)).toBe(true);
  });

  it('derives a deterministic 32-hex-character session label that differs between keys', () => {
    const a = getOrCreateKey({ cwd: '/work/a', cacheDir });
    const b = getOrCreateKey({ cwd: '/work/b', cacheDir });

    expect(sessionLabel(a)).toMatch(/^[0-9a-f]{32}$/);
    expect(sessionLabel(a)).toBe(sessionLabel(a));
    expect(sessionLabel(a)).not.toBe(sessionLabel(b));
  });

  it('does not put the key or the directory into the session label', () => {
    const key = getOrCreateKey({ cwd: '/work/secret-project', cacheDir });
    const label = sessionLabel(key);
    expect(label).not.toContain(key.toString('hex').slice(0, 32));
    expect(label).not.toContain('secret-project');
  });

  it('fails loudly on a malformed store instead of generating a new key over it', () => {
    const storePath = path.join(cacheDir, STORE_FILE);
    fs.writeFileSync(storePath, '{not json', { mode: 0o600 });

    expect(() => getOrCreateKey({ cwd: '/work/app', cacheDir })).toThrow(
      SubmissionKeyStoreUnreadableError
    );
    expect(fs.readFileSync(storePath, 'utf-8')).toBe('{not json');
  });

  it('fails loudly on a store of the wrong shape', () => {
    const storePath = path.join(cacheDir, STORE_FILE);
    fs.writeFileSync(storePath, '[]', { mode: 0o600 });

    expect(() => getOrCreateKey({ cwd: '/work/app', cacheDir })).toThrow(
      SubmissionKeyStoreUnreadableError
    );
  });

  it('fails loudly on an entry that is not a 32-byte key', () => {
    const storePath = path.join(cacheDir, STORE_FILE);
    fs.writeFileSync(storePath, JSON.stringify({ '/work/app': 'c2hvcnQ=' }), { mode: 0o600 });

    expect(() => getOrCreateKey({ cwd: '/work/app', cacheDir })).toThrow(
      SubmissionKeyStoreUnreadableError
    );
  });

  it('never names the store path in the error message', () => {
    const storePath = path.join(cacheDir, STORE_FILE);
    fs.writeFileSync(storePath, '{not json', { mode: 0o600 });

    try {
      getOrCreateKey({ cwd: '/work/app', cacheDir });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(cacheDir);
      expect((error as Error).message).not.toContain(STORE_FILE);
    }
  });
});
