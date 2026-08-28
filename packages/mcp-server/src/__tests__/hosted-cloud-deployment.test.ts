import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProjectCommand } from '../cli/project-command.js';
import { classifyPair } from '../pair-rule.js';

/**
 * A project on the Form.io hosted cloud has exactly ONE deployment:
 * https://api.form.io. That is what makes the Project URL the single configuration
 * for every hosted project — so a recorded Base URL naming anything else is not a
 * second opinion, it is a value that cannot be right.
 *
 * Writes refuse it, because the user is typing it now and a refusal teaches. Reads
 * ignore it and use the derived value, saying so: the correct deployment is KNOWN
 * for this shape, so failing every tool call over a value the server can supply
 * itself would be gratuitous. Either way the wrong value never reaches the
 * portal-login URL or the token-cache key.
 *
 * And the API root is refused by HOST, not by exact string: http://api.form.io and
 * https://api.form.io/<name> are the same mistake as https://api.form.io, and the
 * server's own guidance says so ("https://api.form.io/<project> is not a hosted
 * project URL").
 */
describe('the API root is refused by host, whatever the scheme or path', () => {
  it.each([
    ['the exact root', 'https://api.form.io'],
    ['over http', 'http://api.form.io'],
    ['with a project appended', 'https://api.form.io/myproject'],
    ['with a trailing path', 'https://api.form.io/project/thing'],
  ])('%s is not a project URL', (_label, url) => {
    expect(classifyPair(url, 'https://api.form.io')).toBe('not-a-project-url');
  });

  it('leaves api.form.io alone as a Base URL', () => {
    expect(classifyPair('https://examples.form.io', 'https://api.form.io')).toBe('ok');
  });

  // Not a substring match: a host that merely ends with the API root's name is a
  // different deployment.
  it('does not claim a lookalike host', () => {
    expect(classifyPair('https://not-api.form.io', 'https://api.form.io')).toBe('ok');
  });
});

describe('a hosted-cloud project paired with a foreign deployment', () => {
  it.each([
    ['a customer host', 'https://examples.form.io', 'https://forms.oldcorp.com'],
    ['another form.io host', 'https://examples.form.io', 'https://forms.form.io'],
  ])('%s is classified as a foreign deployment', (_label, projectUrl, baseUrl) => {
    expect(classifyPair(projectUrl, baseUrl)).toBe('hosted-project-foreign-deployment');
  });

  // The verdict for a hosted project is about the DEPLOYMENT half whatever the wrong
  // value is — including the case where it happens to equal the project URL. Asked in
  // the other order, that one value got the Open Source diagnosis, which is
  // definitionally impossible for a form.io host and, because that verdict faults the
  // project half, failed every tool call for the directory instead of deriving the
  // deployment the server already knows.
  it('is a foreign deployment even when the wrong value IS the project URL', () => {
    expect(classifyPair('https://examples.form.io', 'https://examples.form.io')).toBe(
      'hosted-project-foreign-deployment'
    );
  });

  // The collapse verdict still belongs to the shape it describes: a customer-hosted
  // project that is its own deployment names a server with no project layer.
  it('leaves the Open Source collapse to a non-hosted project', () => {
    expect(classifyPair('https://forms.mysite.com', 'https://forms.mysite.com')).toBe(
      'open-source-deployment'
    );
  });

  it('accepts the deployment that actually serves it', () => {
    expect(classifyPair('https://examples.form.io', 'https://api.form.io')).toBe('ok');
  });

  it('says nothing about a customer-hosted project', () => {
    expect(classifyPair('https://myproject.mysite.com', 'https://api.mysite.com')).toBe('ok');
  });
});

// The converse, and the value the base-URL interview is likeliest to be answered
// with: the hosted cloud serves only the projects on it, so it is never a customer
// project's deployment. Stated in three documents as the guess this surface exists to
// prevent, and enforced nowhere until now — it was accepted, recorded, and reported
// `ok`, pointing the portal login and the token cache at Form.io's cloud.
describe('the hosted cloud offered as a customer project’s deployment', () => {
  it.each([
    ['a path-less customer project', 'https://myproject.mysite.com'],
    ['a sub-directory customer project', 'https://forms.mysite.com/myproject'],
  ])('%s is refused', (_label, projectUrl) => {
    expect(classifyPair(projectUrl, 'https://api.form.io')).toBe('api-root-deployment');
  });

  it('leaves a hosted project on api.form.io alone', () => {
    expect(classifyPair('https://examples.form.io', 'https://api.form.io')).toBe('ok');
  });

  it('is refused by the writer, and nothing is recorded', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apiroot-cache-'));
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apiroot-repo-'));
    try {
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      const result = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://myproject.mysite.com',
          '--base-url',
          'https://api.form.io',
          '--cwd',
          repo,
        ],
        { cacheDir, env: {} }
      );

      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.stderr).toMatch(/serves only the projects on it/);
      expect(fs.existsSync(path.join(cacheDir, 'projects.json'))).toBe(false);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('is ignored at read, with the value named, rather than targeting the wrong cloud', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apiroot-read-'));
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-apiroot-readrepo-'));
    try {
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(repo, 'formio.json'),
        JSON.stringify({
          projectUrl: 'https://forms.mysite.com/myproject',
          baseUrl: 'https://api.form.io',
        })
      );

      const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain('Base URL:    https://forms.mysite.com');
      expect(result.stderr).toContain('https://api.form.io');
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

// The general rule the hosted case was one instance of: wherever the deployment is
// DERIVABLE, the derivation is the definition, so a recorded value that differs
// cannot be right. Enforced for a hosted project and nothing else, the other
// derivable shape — a project addressed as a sub-directory — accepted any deployment
// at all, with the writer and the reader agreeing on it and no message anywhere.
describe('a derivable deployment contradicted by a recorded one', () => {
  it.each([
    [
      'its own parent, one level up',
      'https://forms.mysite.com/one/two',
      'https://forms.mysite.com',
    ],
    ['an unrelated host', 'https://forms.mysite.com/myproject', 'https://elsewhere.example.com'],
  ])('%s is refused', (_label, projectUrl, baseUrl) => {
    expect(classifyPair(projectUrl, baseUrl)).toBe('underivable-mismatch');
  });

  it('accepts the value derivation actually yields', () => {
    expect(classifyPair('https://forms.mysite.com/one/two', 'https://forms.mysite.com/one')).toBe(
      'ok'
    );
  });

  // The shape that derives nothing is untouched: there the caller's value is the only
  // one there is.
  it('says nothing about a project that derives no deployment', () => {
    expect(classifyPair('https://myproject.mysite.com', 'https://anything.example.com')).toBe('ok');
  });
});

// A trailing root dot is the same host, resolves identically, and compared exactly it
// walked past every rule in this module.
describe('a host written in its fully-qualified form', () => {
  it('is still the API root, as a project URL', () => {
    expect(classifyPair('https://api.form.io./myproject', 'https://api.form.io')).toBe(
      'not-a-project-url'
    );
  });

  it('is still the API root, as a deployment', () => {
    expect(classifyPair('https://myproject.mysite.com', 'https://api.form.io.')).toBe(
      'api-root-deployment'
    );
  });
});

// form.io carries no project sub-domain, and the site and portal hosts are not
// projects either — pasted into a project prompt they resolved to api.form.io and
// surfaced later as unexplained 404s.
describe('form.io hosts that are not projects', () => {
  it.each([
    ['the apex', 'https://form.io'],
    ['the site', 'https://www.form.io'],
    ['the portal', 'https://portal.form.io'],
  ])('%s is refused as a project URL', (_label, url) => {
    expect(classifyPair(url, 'https://api.form.io')).not.toBe('ok');
  });

  it('leaves a real hosted project alone', () => {
    expect(classifyPair('https://examples.form.io', 'https://api.form.io')).toBe('ok');
  });
});

// The whole verdict table, in one place. Ordering decides which diagnosis a user
// reads AND whether the project or the deployment half is faulted — which in turn
// decides whether a directory fails outright or resolves on a derived value. Each
// reordering in the last three rounds fixed one case and silently moved another, so
// the table is pinned rather than the individual rules.
describe('the verdict for every shape of pair', () => {
  it.each([
    // A hosted project and the one deployment that serves it.
    ['hosted + api root', 'https://examples.form.io', 'https://api.form.io', 'ok'],
    // A scheme change is a different endpoint, and one of them carries credentials in
    // plaintext — so it is refused rather than treated as the same deployment.
    [
      'hosted + the API root over http',
      'https://examples.form.io',
      'http://api.form.io',
      'hosted-project-foreign-deployment',
    ],
    // Wrong deployments for a hosted project — including the value that also
    // collapses, which is NOT an Open Source install: that is impossible for a
    // form.io host, and it faults the project half, failing every call.
    [
      'hosted + itself',
      'https://examples.form.io',
      'https://examples.form.io',
      'hosted-project-foreign-deployment',
    ],
    [
      'hosted + a foreign host',
      'https://examples.form.io',
      'https://forms.oldcorp.com',
      'hosted-project-foreign-deployment',
    ],
    // The hosted cloud is never a customer project's deployment.
    [
      'customer + api root',
      'https://myproject.mysite.com',
      'https://api.form.io',
      'api-root-deployment',
    ],
    // An Open Source install, at the origin OR mounted at a sub-path. The sub-path
    // form was unreachable while the collapse question was asked after derivation.
    [
      'customer origin + itself',
      'https://forms.mysite.com',
      'https://forms.mysite.com',
      'open-source-deployment',
    ],
    [
      'customer sub-path + itself',
      'https://forms.mysite.com/formio',
      'https://forms.mysite.com/formio',
      'open-source-deployment',
    ],
    // A derivable deployment contradicted, and honoured.
    [
      'sub-directory + the wrong parent',
      'https://forms.mysite.com/one/two',
      'https://forms.mysite.com',
      'underivable-mismatch',
    ],
    [
      'sub-directory + its parent',
      'https://forms.mysite.com/one/two',
      'https://forms.mysite.com/one',
      'ok',
    ],
    // The shape that derives nothing: the caller's value is the only one there is.
    [
      'path-less customer + anything',
      'https://myproject.mysite.com',
      'https://api.mysite.com',
      'ok',
    ],
    // form.io hosts that are not projects.
    ['the API root as a project', 'https://api.form.io', undefined, 'not-a-project-url'],
    ['the apex', 'https://form.io', undefined, 'not-a-hosted-project'],
    ['the site', 'https://www.form.io', undefined, 'not-a-hosted-project'],
    ['the portal', 'https://portal.form.io', undefined, 'not-a-hosted-project'],
    [
      'a project name appended to a hosted project',
      'https://examples.form.io/myproject',
      undefined,
      'not-a-hosted-project',
    ],
    ['a hosted project alone', 'https://examples.form.io', undefined, 'ok'],
  ])('%s', (_label, projectUrl, baseUrl, expected) => {
    expect(classifyPair(projectUrl as string, baseUrl as string | undefined)).toBe(expected);
  });
});

// The project half is judged on its own terms. Asked only once a deployment exists,
// the shapes that derive nothing never reached the chokepoint on the write path at
// all — so a form.io host that is not a project was answered by the base-URL branch
// with "a project URL that carries no path on a customer domain", which is false of a
// form.io host, and the command it printed was then refused naming nothing further.
describe('a form.io host that is not a project, offered to the writer', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-reserved-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-reserved-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it.each([
    ['the apex', 'https://form.io'],
    ['the site', 'https://www.form.io'],
    ['the portal', 'https://portal.form.io'],
  ])('is diagnosed as a form.io host, not as a customer domain — %s', (_label, url) => {
    const result = runProjectCommand(['project', 'set', '--project-url', url, '--cwd', repo], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/sub-domain of form\.io/);
    expect(result.stderr).not.toMatch(/carries no path on a customer domain/);
    // And it does not send the caller off to supply a Base URL for it.
    expect(result.stderr).not.toMatch(/--base-url <base_url>/);
  });
});

describe('the writers and the readers, over a hosted project', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-hosted-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-hosted-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const seed = (env: Record<string, string>) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  };
  const commit = (config: Record<string, string>) =>
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(config));
  const get = (env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });

  it('a write naming a foreign deployment is refused, and nothing is recorded', () => {
    const result = runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://examples.form.io',
        '--base-url',
        'https://forms.oldcorp.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toContain('https://api.form.io');
    expect(fs.existsSync(path.join(cacheDir, 'projects.json'))).toBe(false);
  });

  it('a write naming the API root as the project URL is refused over http too', () => {
    const result = runProjectCommand(
      ['project', 'set', '--project-url', 'http://api.form.io', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/API root/);
  });

  it('a write naming the API root plus a project name is refused', () => {
    const result = runProjectCommand(
      ['project', 'set', '--project-url', 'https://api.form.io/myproject', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/API root/);
  });

  // The read side: the deployment is knowable, so the answer resolves — and says
  // which value it set aside, because a stale variable left in place goes on
  // producing this note until somebody removes it.
  it('an environment deployment that cannot serve a hosted project is ignored and named', () => {
    const result = get({
      FORMIO_PROJECT_URL: 'https://examples.form.io',
      FORMIO_BASE_URL: 'https://forms.oldcorp.com',
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('Base URL:    https://api.form.io');
    expect(result.stderr).toMatch(/FORMIO_BASE_URL/);
    expect(result.stderr).toContain('https://forms.oldcorp.com');
  });

  it('the same value in a mapping entry is ignored and named', () => {
    seed({
      FORMIO_PROJECT_URL: 'https://examples.form.io',
      FORMIO_BASE_URL: 'https://forms.oldcorp.com',
    });

    const result = get();

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('Base URL:    https://api.form.io');
    expect(result.stderr).toContain('https://forms.oldcorp.com');
  });

  it('the same value in a committed file is ignored and named', () => {
    commit({ projectUrl: 'https://examples.form.io', baseUrl: 'https://forms.oldcorp.com' });

    const result = get();

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('Base URL:    https://api.form.io');
    expect(result.stderr).toContain(path.join(repo, 'formio.json'));
  });

  it('a hosted project recorded as its own deployment resolves, like any other wrong value', () => {
    commit({ projectUrl: 'https://examples.form.io', baseUrl: 'https://examples.form.io' });

    const result = get();

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('Base URL:    https://api.form.io');
    expect(result.stderr).toMatch(/Ignoring the Base URL/);
    expect(result.stderr).not.toMatch(/Open Source/);
  });

  it('a write pairing a hosted project with itself is refused with the actionable text', () => {
    const result = runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://examples.form.io',
        '--base-url',
        'https://examples.form.io',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toContain('https://api.form.io');
    expect(result.stderr).not.toMatch(/Open Source/);
  });

  // Reached through the deferral rather than typed: a base-URL-only call whose
  // project comes from another record. The refusal must name the offending project
  // URL — the branch that produces it is shape-checked by the compiler, and this
  // pins the message the caller actually reads.
  it('names the API-root project when the deferral meets one', () => {
    const result = runProjectCommand(
      ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
      { cacheDir, env: { FORMIO_PROJECT_URL: 'https://api.form.io' } }
    );

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toContain('https://api.form.io');
    expect(result.stderr).toMatch(/API root/);
    expect(result.stderr).not.toMatch(/undefined/);
  });

  it('a hand-written API-root project URL is still refused at read', () => {
    commit({ projectUrl: 'https://api.form.io/myproject' });

    const result = get();

    expect(result.exitCode, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/API root/);
  });
});
