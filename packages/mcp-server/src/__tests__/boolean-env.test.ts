/**
 * Every boolean environment variable the server reads has one spelling rule:
 * after trimming, `true` or `1` in any case is true, and anything else — unset
 * included — is false. Two variables reading the same value differently is a
 * setting that works for one and is silently ignored by the other.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig, readBooleanEnv } from '../config.js';

const TRUE_SPELLINGS = ['true', 'TRUE', 'True', ' 1 ', '1', '  true  '];
const FALSE_SPELLINGS: (string | undefined)[] = [undefined, '', '0', 'false', 'yes', 'on'];

describe('readBooleanEnv', () => {
  it.each(TRUE_SPELLINGS)('reads %j as true', (raw) => {
    expect(readBooleanEnv(raw)).toBe(true);
  });

  it.each(FALSE_SPELLINGS)('reads %j as false', (raw) => {
    expect(readBooleanEnv(raw)).toBe(false);
  });
});

describe('boolean environment variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_FORCE_BROWSER;
    delete process.env.FORMIO_INSECURE_TLS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setOrClear(name: string, raw: string | undefined) {
    if (raw === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = raw;
    }
  }

  it.each(TRUE_SPELLINGS)('FORMIO_FORCE_BROWSER=%j forces the browser', (raw) => {
    setOrClear('FORMIO_FORCE_BROWSER', raw);
    expect(getConfig().forceBrowser).toBe(true);
  });

  it.each(FALSE_SPELLINGS)('FORMIO_FORCE_BROWSER=%j leaves the browser unforced', (raw) => {
    setOrClear('FORMIO_FORCE_BROWSER', raw);
    expect(getConfig().forceBrowser).toBe(false);
  });

  it.each(TRUE_SPELLINGS)('FORMIO_INSECURE_TLS=%j relaxes certificate checks', (raw) => {
    setOrClear('FORMIO_INSECURE_TLS', raw);
    expect(getConfig().insecureTls).toBe(true);
  });

  it.each(FALSE_SPELLINGS)('FORMIO_INSECURE_TLS=%j leaves certificate checks on', (raw) => {
    setOrClear('FORMIO_INSECURE_TLS', raw);
    expect(getConfig().insecureTls).toBe(false);
  });
});
