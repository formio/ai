import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const stdioSource = readFileSync(resolve(__dirname, '../stdio.ts'), 'utf-8');

describe('stdio.ts entry point', () => {
  it('does not import auth modules', () => {
    const forbiddenImports = [
      'ensure-auth',
      'startup-auth',
      './auth',
      'token-validation',
      'token-cache',
    ];
    forbiddenImports.forEach((mod) => {
      expect(stdioSource, `stdio.ts must not import "${mod}"`).not.toContain(mod);
    });
  });

  // Every documented `project` invocation runs through a pipe, and a piped
  // stdout is asynchronous: exiting the moment after writing can truncate the
  // output the caller parses. Setting the exit code lets Node flush first.
  it('never calls process.exit — the project command sets process.exitCode', () => {
    expect(stdioSource).not.toContain('process.exit(');
    expect(stdioSource).toContain('process.exitCode');
  });

  it('does not call any auth or cache functions directly', () => {
    const forbiddenCalls = [
      'ensureAuthenticated',
      'startupAuth',
      'authenticate(',
      'validateToken',
      'readToken',
      'saveToken',
      'clearToken',
    ];
    forbiddenCalls.forEach((call) => {
      expect(stdioSource, `stdio.ts must not reference "${call}"`).not.toContain(call);
    });
  });
});
