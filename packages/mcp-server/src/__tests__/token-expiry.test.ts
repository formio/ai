import { describe, it, expect } from 'vitest';
import { isJwtExpired } from '../token-expiry.js';

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('isJwtExpired', () => {
  const now = 1_700_000_000_000; // fixed reference time in ms

  it('returns true when exp is in the past', () => {
    const jwt = makeJwt({ exp: Math.floor(now / 1000) - 60 });
    expect(isJwtExpired(jwt, now)).toBe(true);
  });

  it('returns false when exp is comfortably in the future', () => {
    const jwt = makeJwt({ exp: Math.floor(now / 1000) + 3600 });
    expect(isJwtExpired(jwt, now)).toBe(false);
  });

  it('treats a token expiring within the clock-skew window as expired', () => {
    const jwt = makeJwt({ exp: Math.floor(now / 1000) + 5 });
    expect(isJwtExpired(jwt, now)).toBe(true);
  });

  it('returns false when the payload has no exp claim', () => {
    const jwt = makeJwt({ sub: 'user-123' });
    expect(isJwtExpired(jwt, now)).toBe(false);
  });

  it('returns false for a non-JWT opaque string (cannot determine expiry)', () => {
    expect(isJwtExpired('not-a-jwt', now)).toBe(false);
  });

  it('returns false when the payload segment is not valid base64/JSON', () => {
    expect(isJwtExpired('a.!!!.c', now)).toBe(false);
  });

  it('returns false when exp is not a number', () => {
    const jwt = makeJwt({ exp: 'soon' });
    expect(isJwtExpired(jwt, now)).toBe(false);
  });
});
