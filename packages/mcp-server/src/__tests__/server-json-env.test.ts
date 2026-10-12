// server.json is how the MCP Registry, and every installer that reads it, learns
// what can be configured. A variable the server reads but server.json omits is a
// setting nobody installing from the registry is told exists — FORMIO_AUTH_HOST,
// FORMIO_AUTH_PORT and FORMIO_AUTH_TIMEOUT were all missing, and those are exactly
// the ones a container or remote-shell install needs to finish its login.

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(REPO_ROOT, 'packages/mcp-server/src');

interface DeclaredVariable {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

function declared(): DeclaredVariable[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'server.json'), 'utf8')) as {
    packages: Array<{ environmentVariables?: DeclaredVariable[] }>;
  };
  return manifest.packages.flatMap((entry) => entry.environmentVariables ?? []);
}

// Every FORMIO_* name the source reads from an environment object — the process
// environment, or the one the CLI is handed in its place.
function readInSource(): string[] {
  const sources = fg.sync('**/*.ts', { cwd: SRC, ignore: ['__tests__/**'], absolute: true });
  const pattern = /(?:process\.env|\benv)(?:\.|\[['"])(FORMIO_[A-Z0-9_]+)/g;
  const names = sources.flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(pattern)].map((match) => match[1])
  );
  return [...new Set(names)].sort();
}

describe('server.json environment variables', () => {
  it('finds the variables the source reads', () => {
    expect(readInSource()).toEqual(
      expect.arrayContaining(['FORMIO_PROJECT_URL', 'FORMIO_AUTH_PORT', 'FORMIO_INSECURE_TLS'])
    );
  });

  it.each(readInSource())('declares %s', (name) => {
    expect(declared().map((variable) => variable.name)).toContain(name);
  });

  it.each(['FORMIO_AUTH_HOST', 'FORMIO_AUTH_PORT', 'FORMIO_AUTH_TIMEOUT'])(
    'declares %s as optional and not secret, with a description',
    (name) => {
      const variable = declared().find((entry) => entry.name === name);
      expect(variable, `${name} is not declared`).toBeDefined();
      expect(variable?.description).toBeTruthy();
      expect(variable?.isRequired).toBe(false);
      expect(variable?.isSecret).toBe(false);
    }
  );

  it('declares each variable once', () => {
    const names = declared().map((variable) => variable.name);
    expect(names).toEqual([...new Set(names)]);
  });
});
