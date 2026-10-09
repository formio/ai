import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { resolveProject } from '../project-resolver.js';
import { writeProjectEntry } from '../project-map.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { connectTools } from './test-helpers.js';

// FORMIO_API_KEY is issued by one project, so it is in effect only for a project on
// FORMIO_PROJECT_URL's origin. Any other record resolves without it, and the gate
// then runs the portal login exactly as it does with no key set.
describe('FORMIO_API_KEY applies only to the project on FORMIO_PROJECT_URL', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apikey-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apikey-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const commit = (record: Record<string, string>) =>
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(record));

  const resolve = (baseConfig: FormioConfig) => {
    const notes: string[] = [];
    const resolution = resolveProject(repo, baseConfig, {
      cacheDir,
      onNote: (note) => notes.push(note),
    });
    return { config: resolution.config, notes };
  };

  it('is in effect when the resolved project is FORMIO_PROJECT_URL', () => {
    const { config } = resolve({ apiKey: 'k', projectUrl: 'https://examples.form.io' });
    expect(config.projectUrl).toBe('https://examples.form.io');
    expect(config.apiKey).toBe('k');
  });

  it('is in effect for a sub-directory project on the same origin', () => {
    commit({ projectUrl: 'https://forms.mysite.com/myproject' });
    const { config } = resolve({
      apiKey: 'k',
      projectUrl: 'https://forms.mysite.com/myproject',
    });
    expect(config.apiKey).toBe('k');
  });

  it('is not carried to a committed project on another origin, and says so', () => {
    commit({ projectUrl: 'https://other.form.io' });
    const { config, notes } = resolve({ apiKey: 'k', projectUrl: 'https://examples.form.io' });
    expect(config.projectUrl).toBe('https://other.form.io');
    expect(config.apiKey).toBeUndefined();
    expect(notes.join('\n')).toMatch(/FORMIO_API_KEY[\s\S]*https:\/\/examples\.form\.io/);
  });

  it('is not carried to a mapped project when FORMIO_PROJECT_URL is unset, and says so', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' },
      cacheDir,
    });
    const { config, notes } = resolve({ apiKey: 'k' });
    expect(config.projectUrl).toBe('https://mapped.form.io');
    expect(config.apiKey).toBeUndefined();
    expect(notes.join('\n')).toMatch(/FORMIO_API_KEY[\s\S]*FORMIO_PROJECT_URL is unset/);
  });

  it('adds no note when no key is set', () => {
    commit({ projectUrl: 'https://other.form.io' });
    const { notes } = resolve({ projectUrl: 'https://examples.form.io' });
    expect(notes.join('\n')).not.toContain('FORMIO_API_KEY');
  });

  it('project_get reports the unapplied key', async () => {
    commit({ projectUrl: 'https://other.form.io' });
    const client = await connectTools((server) =>
      registerProjectGetTool(server, { apiKey: 'k', projectUrl: 'https://examples.form.io' })
    );
    const result = (await client.callTool({ name: 'project_get', arguments: { cwd: repo } })) as {
      structuredContent?: { notes?: string[] };
    };
    expect((result.structuredContent?.notes ?? []).join('\n')).toMatch(
      /FORMIO_API_KEY is set but not applied/
    );
  });
});
