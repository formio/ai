// Decode a JWT's payload (without verifying its signature) and decide whether
// it is expired. We only need the `exp` claim to know whether a cached token is
// safe to reuse; signature verification requires the server's secret and is out
// of scope — the network never trusts our local decode, it re-validates.
//
// Conservative by design: when expiry cannot be determined (opaque string,
// malformed segment, missing/non-numeric `exp`), we report NOT expired and let
// the existing network validation / 401-retry path make the final call. That
// keeps behavior unchanged for non-JWT tokens while still catching the common
// case — a real, plainly-expired JWT — before it is ever sent.

// Treat tokens that expire within this window as already expired, so we never
// hand off a token that dies mid-request.
const CLOCK_SKEW_MS = 30_000;

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const segments = jwt.split('.');
  if (segments.length < 2) {
    return null;
  }
  try {
    const json = Buffer.from(segments[1], 'base64url').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(
  jwt: string,
  nowMs: number = Date.now(),
  skewMs: number = CLOCK_SKEW_MS
): boolean {
  const payload = decodeJwtPayload(jwt);
  if (!payload || typeof payload.exp !== 'number') {
    return false;
  }
  const expMs = payload.exp * 1000;
  return expMs - skewMs <= nowMs;
}
