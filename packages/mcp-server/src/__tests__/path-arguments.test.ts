import { describe, it, expect } from 'vitest';
import {
  checkProjectPath,
  checkResourceSegment,
  projectPathArgument,
  resourceSegmentArgument,
} from '../tools/path-arguments.js';

const REFUSED_PATHS = [
  '',
  'https://example.com/x',
  'mailto:x',
  '/user/login',
  '//example.com/x',
  'user\\login',
  'user//login',
  './user',
  'user/..',
  'user/../../other',
];

describe('checkProjectPath', () => {
  it.each(['user/login', 'form/65a1b2c3d4e5f60718293a4b', 'a/b/c', 'contact'])(
    'accepts %j',
    (value) => {
      expect(checkProjectPath(value)).toBeUndefined();
    }
  );

  it.each(REFUSED_PATHS)('refuses %j', (value) => {
    expect(checkProjectPath(value)).toEqual(expect.any(String));
  });
});

describe('checkResourceSegment', () => {
  it.each(['3', 'email', '65a1b2c3d4e5f60718293a4b'])('accepts %j', (value) => {
    expect(checkResourceSegment(value)).toBeUndefined();
  });

  it.each([...REFUSED_PATHS, 'abc/def', 'user/login'])('refuses %j', (value) => {
    expect(checkResourceSegment(value)).toEqual(expect.any(String));
  });
});

describe('path argument schemas', () => {
  it('projectPathArgument names the argument and the accepted shape in its refusal', () => {
    const result = projectPathArgument('formIdOrPath').safeParse('https://example.com/x');
    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? '';
    expect(message).toContain('formIdOrPath');
    expect(message).toContain('https://example.com/x');
    expect(message).toMatch(/form ID or a form path/i);
  });

  it('projectPathArgument passes a form path through unchanged', () => {
    expect(projectPathArgument('formIdOrPath').parse('user/login')).toBe('user/login');
  });

  it('resourceSegmentArgument names the argument and the accepted shape in its refusal', () => {
    const result = resourceSegmentArgument('actionId').safeParse('abc/def');
    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? '';
    expect(message).toContain('actionId');
    expect(message).toContain('abc/def');
    expect(message).toMatch(/single path segment/i);
  });

  it('resourceSegmentArgument passes a single segment through unchanged', () => {
    expect(resourceSegmentArgument('version').parse('3')).toBe('3');
  });
});
