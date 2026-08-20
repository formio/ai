import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';

// One configuration to think about: the Project URL. The base URL has exactly two
// outcomes now — DERIVED from the project URL, or ABSENT and asked for. There is
// no third that reads as a guess, because after the shape rules no guess remains:
// api.form.io for a form.io host is the one deployment whose base URL is a
// constant, so naming it from the host IS a derivation.
describe('the base URL is derived or asked for, never defaulted', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-derived-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  const resolveFor = (projectUrl: string, cwd = '/w/derived') => {
    writeProjectEntry(cwd, { FORMIO_PROJECT_URL: projectUrl }, cacheDir);
    return resolveProject(cwd, {}, { cacheDir, onNote: () => {} });
  };

  it('reports a hosted-cloud base URL as derived, with the value unchanged', () => {
    const { config, sources } = resolveFor('https://examples.form.io');

    expect(config.baseUrl).toBe('https://api.form.io');
    expect(sources.baseUrl).toBe('derived');
  });

  it('reports a sub-directory base URL as derived', () => {
    const { sources } = resolveFor('https://forms.mysite.com/one/two');

    expect(sources.baseUrl).toBe('derived');
  });

  it('reports an underivable base URL as unresolved', () => {
    const { sources } = resolveFor('https://myproject.mysite.com');

    expect(sources.baseUrl).toBe('unresolved');
  });

  // Asserted against the source file so the string cannot come back through a
  // future edit that merely satisfies the behavioural tests.
  it('admits no default member in the BaseUrlSource union', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../project-resolver.ts'), 'utf8');
    const union = source.slice(
      source.indexOf('export type BaseUrlSource'),
      source.indexOf(';', source.indexOf('export type BaseUrlSource'))
    );

    expect(union).toContain("'derived'");
    expect(union).toContain("'unresolved'");
    expect(union).not.toContain("'default'");
  });

  it('describes the hosted-cloud base URL as derived in project get output', () => {
    writeProjectEntry(
      '/w/get-derived',
      { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      cacheDir
    );

    const result = runProjectCommand(['project', 'get', '--cwd', '/w/get-derived'], {
      cacheDir,
      env: {},
    });

    expect(result.stdout).toMatch(/deriv/i);
    expect(result.stdout).not.toMatch(/the default/i);
  });
});

// Guidance goes where it can be acted on. The base URL is derived from whichever
// project URL the user is about to supply, so shape guidance about it cannot be
// acted on before that answer exists — carrying it in the unset-project error made
// a message asking for one value read as asking for two.
describe('configuration guidance is placed where it is actionable', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-guidance-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  const unsetProjectMessage = () => {
    const result = runProjectCommand(['project', 'get', '--cwd', '/w/unmapped-guidance'], {
      cacheDir,
      env: {},
    });
    return `${result.stdout}${result.stderr}`;
  };

  it('the unset-project message asks for the project and describes what one is', () => {
    const message = unsetProjectMessage();

    expect(message).toContain('project set');
    expect(message).toMatch(/Project URL/i);
    expect(message).toContain('https://examples.form.io');
  });

  it('the unset-project message does not ask for a base URL', () => {
    const message = unsetProjectMessage();

    expect(message).not.toMatch(/--base-url/);
    expect(message).not.toMatch(/three valid shapes/i);
  });

  it('the base-URL message keeps the sub-domain explanation', () => {
    writeProjectEntry(
      '/w/subdomain-guidance',
      { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir
    );

    const result = runProjectCommand(['project', 'get', '--cwd', '/w/subdomain-guidance'], {
      cacheDir,
      env: {},
    });

    expect(result.stderr).toContain('--base-url');
    expect(result.stderr).toMatch(/sibling sub-?domain/i);
  });
});
