import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXIT_NOT_CONFIGURED, runProjectCommand } from '../cli/project-command.js';

/**
 * The two "you typed the wrong URL back" refusals — the hosted cloud's API root
 * offered as a project, and a pair collapsed onto one server — exist to catch a
 * mistake mid-interview, so both exit 1: the code that means "act on this message,
 * ask again". Reporting either as 2 told every caller to relay and stop, which
 * abandoned the very setup round the refusal exists to redirect.
 *
 * And notes travel with every refusal: an "Ignoring FORMIO_PROJECT_URL: ..." note is
 * often part of the story of how the caller got here, and dropping it on one refusal
 * out of six left that one message unexplained.
 */
describe('the wrong-URL refusals', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-wrongurl-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-wrongurl-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const set = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'set', ...args, '--cwd', repo], { cacheDir, env });

  it('exits 1 for the API root offered as a project URL', () => {
    const result = set(['--project-url', 'https://api.form.io']);

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toMatch(/API root/);
  });

  it('exits 1 for a pair collapsed onto one server', () => {
    const result = set([
      '--project-url',
      'https://forms.mysite.com',
      '--base-url',
      'https://forms.mysite.com',
    ]);

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toMatch(/Enterprise/);
  });

  it('keeps the notes it collected on the API-root refusal', () => {
    const result = set(['--project-url', 'https://api.form.io'], {
      FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}',
    });

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toMatch(/Ignoring FORMIO_PROJECT_URL/);
  });

  it('keeps the notes it collected on the collapsed-pair refusal', () => {
    const result = set(
      ['--project-url', 'https://forms.mysite.com', '--base-url', 'https://forms.mysite.com'],
      { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' }
    );

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toMatch(/Ignoring FORMIO_PROJECT_URL/);
  });
});
