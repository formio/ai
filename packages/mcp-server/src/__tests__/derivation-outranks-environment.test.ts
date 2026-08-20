import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import { resolveProject } from '../project-resolver.js';

// FORMIO_BASE_URL is ONE global answering a per-project question. The writers
// already refuse to persist it for a project that names its own deployment; the
// read path did not, so with the variable merely exported the derivation lost
// anyway and the guard bought nothing. api.form.io is the value most likely to be
// left over in a shell, which makes the failure a portal login and a token-cache
// key pointed at a deployment the user does not use.
describe('a derivable base URL outranks the environment global', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-derive-rank-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  const resolveFor = (projectUrl: string, baseUrl: string | undefined, cwd = '/w/rank') => {
    writeProjectEntry(cwd, { FORMIO_PROJECT_URL: projectUrl }, cacheDir);
    return resolveProject(cwd, { baseUrl }, { cacheDir, onNote: () => {} });
  };

  it('derives a sub-directory deployment despite a global naming another', () => {
    const { config, sources } = resolveFor(
      'https://forms.mysite.com/myproject',
      'https://api.form.io'
    );

    expect(config.baseUrl).toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('derived');
  });

  it('derives the hosted cloud despite a global naming a customer deployment', () => {
    const { config, sources } = resolveFor('https://examples.form.io', 'https://forms.mysite.com');

    expect(config.baseUrl).toBe('https://api.form.io');
    expect(sources.baseUrl).toBe('derived');
  });

  // The shadowed value is still REPORTED. Dropping it from the answer without
  // saying so leaves "my FORMIO_BASE_URL did nothing" unanswerable from the one
  // command that exists to answer it.
  it('still lists the global as a shadowed candidate', () => {
    const { baseUrlCandidates } = resolveFor(
      'https://forms.mysite.com/myproject',
      'https://api.form.io'
    );

    expect(baseUrlCandidates.environment).toBe('https://api.form.io');
  });

  // The one shape that names no deployment of its own is the one the global is
  // for. Ranking derivation first must not make it unreachable.
  it('still reads the global for a project that derives nothing', () => {
    const { config, sources } = resolveFor(
      'https://myproject.mysite.com',
      'https://forms.mysite.com'
    );

    expect(config.baseUrl).toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('environment');
  });

  // Suppressing the global outright is not the answer either. A deployment whose
  // API root is NOT the project URL's parent — mounted at /api beside the
  // projects it serves — has no other way to say so on a launch configured purely
  // by environment: no writable ~/.formio, no committed file. Same host is a
  // statement about THIS deployment's own layout, which is exactly what the stale
  // global never is.
  it('reads a global on the project’s own host over the parent path it would derive', () => {
    const { config, sources } = resolveFor(
      'https://forms.mysite.com/myproject',
      'https://forms.mysite.com/api',
      '/w/rank-same-origin'
    );

    expect(config.baseUrl).toBe('https://forms.mysite.com/api');
    expect(sources.baseUrl).toBe('environment');
  });

  it('says why it dropped a global on another host', () => {
    const notes: string[] = [];
    writeProjectEntry(
      '/w/rank-noted',
      { FORMIO_PROJECT_URL: 'https://forms.mysite.com/myproject' },
      cacheDir
    );

    resolveProject(
      '/w/rank-noted',
      { baseUrl: 'https://api.form.io' },
      { cacheDir, onNote: (message) => notes.push(message) }
    );

    expect(notes.join('\n')).toContain('Ignoring FORMIO_BASE_URL');
    expect(notes.join('\n')).toContain('https://forms.mysite.com');
  });

  // A *.form.io host is never a base URL, and every project on the hosted cloud is
  // served by api.form.io — so nothing the variable holds there can be a
  // correction, same host or not.
  it('ignores a global on the project’s own host for a hosted-cloud project', () => {
    const { config, sources } = resolveFor(
      'https://examples.form.io',
      'https://examples.form.io',
      '/w/rank-hosted'
    );

    expect(config.baseUrl).toBe('https://api.form.io');
    expect(sources.baseUrl).toBe('derived');
  });

  // A mapping is a per-directory statement the user wrote, not a global, so it
  // keeps its rank above derivation.
  it('leaves a mapped deployment above derivation', () => {
    writeProjectEntry(
      '/w/rank-mapped',
      {
        FORMIO_PROJECT_URL: 'https://forms.mysite.com/myproject',
        FORMIO_BASE_URL: 'https://api.mysite.com',
      },
      cacheDir
    );

    const { config, sources } = resolveProject(
      '/w/rank-mapped',
      { baseUrl: 'https://api.form.io' },
      { cacheDir, onNote: () => {} }
    );

    expect(config.baseUrl).toBe('https://api.mysite.com');
    expect(sources.baseUrl).toBe('mapping');
  });
});
