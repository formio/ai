import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getConfig } from '../config.js';
import { resolveProjectConfig } from '../project-resolver.js';
import { SERVER_INSTRUCTIONS } from '../server.js';
import { runProjectCommand } from '../cli/project-command.js';

// The inverse of what `default-project-offer.test.ts` used to assert.
//
// `FORMIO_DEFAULT_PROJECT_URL` existed for one reason: `FORMIO_PROJECT_URL`
// pinned the server and `project_set` could not redirect it, so an install-time
// prompt wired to it would silently defeat every later mapping. The offering
// variable was the workaround.
//
// The scope reorder removed the premise. The environment is now the WEAKEST
// source — a committed formio.json wins, then the working-directory mapping, then
// the environment — so a project set there is already overridden by both stronger
// sources. It suggests without pinning, which is exactly what the second variable
// was invented to provide. What is left of it is a suggestion an agent may act on
// instead of asking, which is worse than no value when asking is correct.
const OFFERED_URL = 'https://suggested.form.io';
const UNMAPPED_CWD = '/workspace/no-offer-unmapped';

describe('no variable offers a project', () => {
  let cacheDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-no-offer-'));
    process.env = { ...originalEnv };
    for (const key of ['FORMIO_PROJECT_URL', 'FORMIO_BASE_URL', 'FORMIO_DEFAULT_PROJECT_URL']) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('is not read from the environment', () => {
    process.env.FORMIO_DEFAULT_PROJECT_URL = OFFERED_URL;

    const config = getConfig() as Record<string, unknown>;

    expect(config.defaultProjectUrl).toBeUndefined();
    expect(Object.keys(config)).not.toContain('defaultProjectUrl');
  });

  it('does not appear in the resolution error', () => {
    process.env.FORMIO_DEFAULT_PROJECT_URL = OFFERED_URL;

    let message = '';
    try {
      resolveProjectConfig(UNMAPPED_CWD, {}, { cacheDir, onNote: () => {} });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('project_set');
    expect(message).not.toContain(OFFERED_URL);
    expect(message).not.toMatch(/suggest/i);
  });

  // The message a caller sees must not depend on a variable that takes no part in
  // resolution: two different errors for the same unresolved state is the
  // confusion the removal exists to end.
  it('produces the same error whether or not it is set', () => {
    const messageFor = (offered?: string) => {
      if (offered) {
        process.env.FORMIO_DEFAULT_PROJECT_URL = offered;
      } else {
        delete process.env.FORMIO_DEFAULT_PROJECT_URL;
      }
      try {
        resolveProjectConfig(UNMAPPED_CWD, {}, { cacheDir, onNote: () => {} });
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error('expected resolution to fail');
    };

    expect(messageFor(OFFERED_URL)).toBe(messageFor(undefined));
  });

  it('does not appear in the server instructions', () => {
    expect(SERVER_INSTRUCTIONS).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
  });

  it('does not appear in project get output', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', UNMAPPED_CWD], {
      cacheDir,
      env: { FORMIO_DEFAULT_PROJECT_URL: OFFERED_URL },
    });

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(OFFERED_URL);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/suggest/i);
  });

  it('is absent from the registry environment list', () => {
    const registry = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../../server.json'), 'utf8')
    ) as { packages: Array<{ environmentVariables?: Array<{ name: string }> }> };
    const names = registry.packages.flatMap((pkg) =>
      (pkg.environmentVariables ?? []).map((variable) => variable.name)
    );

    expect(names).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
    expect(names).toContain('FORMIO_PROJECT_URL');
  });
});
