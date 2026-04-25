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
