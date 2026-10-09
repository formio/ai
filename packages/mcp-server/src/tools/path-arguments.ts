import { z } from 'zod';

/**
 * The one rule for a tool argument that becomes part of a request path.
 *
 * Tools join their arguments onto the Project URL, and `new URL` resolves what it is
 * given: a value carrying a scheme or a leading `//` replaces the project's origin,
 * and a `..` segment walks out of the project's path. A form path legitimately holds
 * `/` separators (`user/login`), so the value is checked rather than encoded.
 *
 * Each check returns why a value is refused, or undefined when it is accepted.
 */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function checkProjectPath(value: string): string | undefined {
  if (value === '') {
    return 'it is empty';
  }
  if (SCHEME.test(value)) {
    return 'it carries a URL scheme';
  }
  if (value.startsWith('/')) {
    return 'it begins with "/"';
  }
  if (value.includes('\\')) {
    return 'it contains a backslash';
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '')) {
    return 'it has an empty path segment';
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return 'it has a "." or ".." segment';
  }
  return undefined;
}

export function checkResourceSegment(value: string): string | undefined {
  const pathProblem = checkProjectPath(value);
  if (pathProblem) {
    return pathProblem;
  }
  return value.includes('/') ? 'it contains "/"' : undefined;
}

function pathArgument({
  name,
  check,
  accepts,
}: {
  name: string;
  check: (value: string) => string | undefined;
  accepts: string;
}) {
  return z.string().superRefine((value, ctx) => {
    const problem = check(value);
    if (problem) {
      ctx.addIssue({
        code: 'custom',
        message: `${name} ${JSON.stringify(value)} is not accepted: ${problem}. ${name} takes ${accepts}.`,
      });
    }
  });
}

export function projectPathArgument(name: string) {
  return pathArgument({
    name,
    check: checkProjectPath,
    accepts:
      'a form ID or a form path relative to the project, such as "user/login" — no scheme, leading "/", backslash, "." or ".." segment',
  });
}

export function resourceSegmentArgument(name: string) {
  return pathArgument({
    name,
    check: checkResourceSegment,
    accepts:
      'a single path segment naming one resource, such as an ID — no "/", scheme, backslash, "." or ".."',
  });
}
