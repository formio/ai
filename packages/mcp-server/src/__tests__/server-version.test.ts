import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { SERVER_VERSION } from '../server.js';

const require = createRequire(import.meta.url);

describe('SERVER_VERSION', () => {
  // Clients display this in their server list, so a stale literal misreports
  // which build is running.
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(require.resolve('../../package.json'), 'utf-8')) as {
      version: string;
    };

    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it('is not the historical placeholder', () => {
    expect(SERVER_VERSION).not.toBe('0.1.0');
  });
});
