import { describe, it, expect } from 'vitest';
import { isInsecureTlsEnabled } from '../formio-client.js';

describe('isInsecureTlsEnabled', () => {
  it('returns true for "true"', () => {
    expect(isInsecureTlsEnabled('true')).toBe(true);
  });

  it('returns true for "1"', () => {
    expect(isInsecureTlsEnabled('1')).toBe(true);
  });

  it('returns true for mixed/upper case "TRUE"', () => {
    expect(isInsecureTlsEnabled('TRUE')).toBe(true);
    expect(isInsecureTlsEnabled('True')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isInsecureTlsEnabled('  true  ')).toBe(true);
    expect(isInsecureTlsEnabled(' 1 ')).toBe(true);
  });

  it('returns false for falsy/other values', () => {
    expect(isInsecureTlsEnabled(undefined)).toBe(false);
    expect(isInsecureTlsEnabled('')).toBe(false);
    expect(isInsecureTlsEnabled('0')).toBe(false);
    expect(isInsecureTlsEnabled('false')).toBe(false);
    expect(isInsecureTlsEnabled('yes')).toBe(false);
  });
});
