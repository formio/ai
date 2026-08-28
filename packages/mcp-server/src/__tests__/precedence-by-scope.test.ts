import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { resolveProject } from '../project-resolver.js';

// Precedence is by SCOPE, narrowest first: the committed file states what the
// code targets, the mapping states what one machine targets, the environment is a
// process-wide default. Before this, the project URL resolved environment-first
// while the base URL already resolved mapping-first — one pair, two directions.
describe('resolution precedence by scope', () => {
  let root: string;
  let cacheDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-precedence-'));
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-precedence-cache-'));
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function commit(contents: Record<string, unknown>): void {
    fs.writeFileSync(path.join(root, COMMITTED_CONFIG_FILE), JSON.stringify(contents));
  }

  const resolve = (baseConfig: FormioConfig = {}) =>
    resolveProject(root, baseConfig, { cacheDir, onNote: () => {} });

  it('prefers the committed file over a personal mapping', () => {
    commit({ projectUrl: 'https://committed.form.io' });
    writeProjectEntry({
      cwd: root,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir: cacheDir,
    });

    const { config, sources } = resolve();

    expect(config.projectUrl).toBe('https://committed.form.io');
    expect(sources.projectUrl).toBe('committed');
  });

  // The reversal of the old rule, so the environment value must be provably unused.
  it('prefers a personal mapping over the environment', () => {
    writeProjectEntry({
      cwd: root,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir: cacheDir,
    });

    const { config, sources } = resolve({ projectUrl: 'https://env-project.form.io' });

    expect(config.projectUrl).toBe('https://mapped.form.io');
    expect(sources.projectUrl).toBe('mapping');
  });

  it('falls back to the environment when nothing else supplies a project', () => {
    const { config, sources } = resolve({ projectUrl: 'https://env-project.form.io' });

    expect(config.projectUrl).toBe('https://env-project.form.io');
    expect(sources.projectUrl).toBe('environment');
  });

  // Determinism comes from being the only candidate, not from rank.
  it('resolves a CI-shaped setup that supplies only the environment', () => {
    const { config, sources } = resolve({ projectUrl: 'https://ci-target.form.io' });

    expect(config.projectUrl).toBe('https://ci-target.form.io');
    expect(sources.projectUrl).toBe('environment');
  });

  it('resolves the base URL through the same order', () => {
    commit({ projectUrl: 'https://a.mysite.com', baseUrl: 'https://committed-base.mysite.com' });
    writeProjectEntry({
      cwd: root,
      env: {
        FORMIO_PROJECT_URL: 'https://b.mysite.com',
        FORMIO_BASE_URL: 'https://mapped-base.mysite.com',
      },
      cacheDir: cacheDir,
    });

    const { config, sources } = resolve({ baseUrl: 'https://env-base.mysite.com' });

    expect(config.baseUrl).toBe('https://committed-base.mysite.com');
    expect(sources.baseUrl).toBe('committed');
  });

  it('still derives the base URL by shape when no source supplies one', () => {
    commit({ projectUrl: 'https://forms.mysite.com/one/two' });

    const { config, sources } = resolve();

    expect(config.baseUrl).toBe('https://forms.mysite.com/one');
    expect(sources.baseUrl).toBe('derived');
  });

  // Today's spec forbids this: an environment project URL pinned the server and
  // project_set could not redirect it.
  it('lets a mapping redirect a directory whose environment names another project', () => {
    writeProjectEntry({
      cwd: root,
      env: { FORMIO_PROJECT_URL: 'https://redirected.form.io' },
      cacheDir: cacheDir,
    });

    expect(resolve({ projectUrl: 'https://pinned.form.io' }).config.projectUrl).toBe(
      'https://redirected.form.io'
    );
  });

  it('leaves an API-key deployment with an unresolved base URL resolvable', () => {
    commit({ projectUrl: 'https://myproject.mysite.com' });

    const { config, sources } = resolve({ apiKey: 'secret-key' });

    expect(config.projectUrl).toBe('https://myproject.mysite.com');
    expect(config.baseUrl).toBeUndefined();
    expect(sources.baseUrl).toBe('unresolved');
  });

  it('fails on a broken committed file rather than reporting nothing configured', () => {
    fs.writeFileSync(path.join(root, COMMITTED_CONFIG_FILE), '{ not json');
    writeProjectEntry({
      cwd: root,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir: cacheDir,
    });

    let message = '';
    try {
      resolve();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(COMMITTED_CONFIG_FILE);
    expect(message).not.toMatch(/No Form\.io project is configured/);
  });

  it('names formio.json alongside project_set when nothing is configured', () => {
    let message = '';
    try {
      resolve();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('project_set');
    expect(message).toContain(COMMITTED_CONFIG_FILE);
  });
});
