/**
 * Every boolean environment variable the server reads has one spelling rule:
 * after trimming, `true` or `1` in any case is true, and anything else — unset
 * included — is false. Two variables reading the same value differently is a
 * setting that works for one and is silently ignored by the other.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
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

  // FORMIO_INSECURE_TLS is applied once, when the client module loads.
  async function insecureTlsAppliedFor(raw: string | undefined): Promise<boolean> {
    setOrClear('FORMIO_INSECURE_TLS', raw);
    vi.resetModules();
    await import('../formio-client.js');
    return process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';
  }

  it.each(TRUE_SPELLINGS)('FORMIO_FORCE_BROWSER=%j forces the browser', (raw) => {
    setOrClear('FORMIO_FORCE_BROWSER', raw);
    expect(getConfig().forceBrowser).toBe(true);
  });

  it.each(FALSE_SPELLINGS)('FORMIO_FORCE_BROWSER=%j leaves the browser unforced', (raw) => {
    setOrClear('FORMIO_FORCE_BROWSER', raw);
    expect(getConfig().forceBrowser).toBe(false);
  });

  it.each(TRUE_SPELLINGS)('FORMIO_INSECURE_TLS=%j disables certificate checks', async (raw) => {
    expect(await insecureTlsAppliedFor(raw)).toBe(true);
  });

  it.each(FALSE_SPELLINGS)('FORMIO_INSECURE_TLS=%j leaves certificate checks on', async (raw) => {
    expect(await insecureTlsAppliedFor(raw)).toBe(false);
  });
});
