import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyPair, faultedHalf } from '../pair-rule.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';
import { writeProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

// A path-less project URL on a customer domain names its deployment nowhere: the
// deployment is a sibling sub-domain of the same parent. So the pair is accepted only
// where both hosts share a registrable domain, computed against the public suffix list.
describe('a path-less customer project pairs only with a deployment on its registrable domain', () => {
  it.each([
    ['the documented sibling shape', 'https://myproject.mysite.com', 'https://api.mysite.com'],
    [
      'a deployment deeper in the domain',
      'https://myproject.forms.mysite.com',
      'https://forms.mysite.com',
    ],
    ['a multi-label public suffix', 'https://myproject.mysite.co.uk', 'https://api.mysite.co.uk'],
    ['a local single-label host', 'http://myproject.localhost:3000', 'http://localhost:3000'],
    ['a local reserved TLD', 'https://myproject.form.test', 'https://api.form.test'],
  ])('accepts %s', (_label, projectUrl, baseUrl) => {
    expect(classifyPair(projectUrl, baseUrl)).toBe('ok');
  });

  it.each([
    ['an unrelated domain', 'https://myproject.mysite.com', 'https://forms.othersite.com'],
    [
      'another site under the same public suffix',
      'https://myproject.mysite.co.uk',
      'https://api.othersite.co.uk',
    ],
    [
      'another tenant of a shared hosting suffix',
      'https://a.herokuapp.com',
      'https://b.herokuapp.com',
    ],
  ])('refuses %s', (_label, projectUrl, baseUrl) => {
    expect(classifyPair(projectUrl, baseUrl)).toBe('unrelated-deployment');
  });

  it('honours a forced pair', () => {
    expect(
      classifyPair('https://myproject.mysite.com', 'https://forms.othersite.com', { forced: true })
    ).toBe('ok');
  });

  it('is a verdict about the deployment half', () => {
    expect(faultedHalf('unrelated-deployment')).toBe('deployment');
  });

  it('leaves hosted and sub-directory projects to their existing verdicts', () => {
    expect(classifyPair('https://examples.form.io', 'https://api.form.io')).toBe('ok');
    expect(classifyPair('https://forms.mysite.com/myproject', 'https://forms.mysite.com')).toBe(
      'ok'
    );
    expect(classifyPair('https://myproject.mysite.com', 'https://api.form.io')).toBe(
      'api-root-deployment'
    );
  });
});

describe('the registrable-domain rule at the writers and the reader', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-related-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-related-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const UNRELATED = ['https://myproject.mysite.com', 'https://forms.othersite.com'] as const;
  const RULE = /registrable domain/;

  const resolve = (baseConfig = {}) => {
    const notes: string[] = [];
    const resolution = resolveProject(repo, baseConfig, {
      cacheDir,
      onNote: (note) => notes.push(note),
    });
    return { resolution, notes: notes.join('\n') };
  };

  it('`project set` refuses the pair, naming both hosts and the rule, and records nothing', () => {
    const result = runProjectCommand(
      ['project', 'set', '--project-url', UNRELATED[0], '--base-url', UNRELATED[1], '--cwd', repo],
      { cacheDir, env: {} }
    );
    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toMatch(RULE);
    expect(result.stderr).toContain('myproject.mysite.com');
    expect(result.stderr).toContain('forms.othersite.com');
    expect(fs.existsSync(path.join(cacheDir, 'projects.json'))).toBe(false);
  });

  it('`project set --force` records the pair', () => {
    const result = runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        UNRELATED[0],
        '--base-url',
        UNRELATED[1],
        '--force',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );
    expect(result.exitCode, result.stderr).toBe(0);
  });

  it('project_set refuses the pair, naming the rule', async () => {
    const client = await connectTools((server) => registerProjectSetTool(server));
    const result = (await client.callTool({
      name: 'project_set',
      arguments: { cwd: repo, projectUrl: UNRELATED[0], baseUrl: UNRELATED[1] },
    })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content.map((entry) => entry.text).join('\n')).toMatch(RULE);
  });

  it('sets aside an unrelated deployment in a committed file, leaving it unresolved', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: UNRELATED[0], baseUrl: UNRELATED[1] })
    );
    const { resolution, notes } = resolve();
    expect(resolution.config.projectUrl).toBe(UNRELATED[0]);
    expect(resolution.config.baseUrl).toBeUndefined();
    expect(resolution.sources.baseUrl).toBe('unresolved');
    expect(notes).toMatch(RULE);
    expect(notes).toContain('formio.json');
  });

  it('sets aside an unrelated deployment in a mapping entry', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: UNRELATED[0], FORMIO_BASE_URL: UNRELATED[1] },
      cacheDir,
    });
    const { resolution, notes } = resolve();
    expect(resolution.config.baseUrl).toBeUndefined();
    expect(notes).toMatch(RULE);
  });

  it('sets aside an unrelated deployment in the environment', () => {
    const { resolution, notes } = resolve({ projectUrl: UNRELATED[0], baseUrl: UNRELATED[1] });
    expect(resolution.config.baseUrl).toBeUndefined();
    expect(notes).toMatch(RULE);
  });

  it('resolves a forced mapping entry with no note', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: UNRELATED[0], FORMIO_BASE_URL: UNRELATED[1] },
      forced: true,
      cacheDir,
    });
    const { resolution, notes } = resolve();
    expect(resolution.config.baseUrl).toBe(UNRELATED[1]);
    expect(notes).not.toMatch(RULE);
  });

  // Every shape formio-mcp-setup/references/project-urls.md documents resolves as
  // before: no note, nothing set aside.
  it.each([
    [{ projectUrl: 'https://examples.form.io' }, 'https://api.form.io'],
    [{ projectUrl: 'https://forms.mysite.com/myproject' }, 'https://forms.mysite.com'],
    [
      { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' },
      'https://api.mysite.com',
    ],
  ])('resolves the documented shape %j with no note', (record, expectedBaseUrl) => {
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(record));
    const { resolution, notes } = resolve();
    expect(resolution.config.baseUrl).toBe(expectedBaseUrl);
    expect(notes).toBe('');
  });
});
