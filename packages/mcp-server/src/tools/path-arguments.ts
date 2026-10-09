import { z } from 'zod';

/**
 * The one rule for a tool argument that becomes part of a request path.
 *
 * Tools join their arguments onto the Project URL, and `new URL` resolves what it is
 * given: a scheme or a leading `//` replaces the project's origin, a `.` or `..`
 * segment walks up its path — including the percent-encoded `%2e%2e`, which the
 * parser decodes — and a `?` or `#` cuts off the rest of the templated path. So the
 * rule is an allowlist rather than a list of shapes to refuse: every segment is the
 * characters Form.io itself accepts in a form path (letters, digits and `-`;
 * `formio/src/models/Form.js`), plus `_`. That covers form paths, ObjectIds,
 * revision numbers and action type names, and nothing the parser reinterprets.
 *
 * Each check returns why a value is refused, or undefined when it is accepted.
 */
const SEGMENT = /^[A-Za-z0-9_-]+$/;

export function checkProjectPath(value: string): string | undefined {
  if (value === '') {
    return 'it is empty';
  }
  if (value.startsWith('/')) {
    return 'it begins with "/"';
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '')) {
    return 'it has an empty path segment';
  }
  if (!segments.every((segment) => SEGMENT.test(segment))) {
    return 'a path segment holds a character other than a letter, digit, "-" or "_"';
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
      'a form ID or a form path relative to the project, such as "user/login" — segments of letters, digits, "-" and "_" separated by "/"',
  });
}

export function resourceSegmentArgument(name: string) {
  return pathArgument({
    name,
    check: checkResourceSegment,
    accepts:
      'a single path segment naming one resource, such as an ID — letters, digits, "-" and "_" only',
  });
}
