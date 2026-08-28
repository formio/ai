import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { EXIT_BASE_URL_UNRESOLVED, runProjectCommand } from '../cli/project-command.js';
import { connectTools } from './test-helpers.js';

// Everything here is about ONE value that has no home of its own: a base URL for
// a project recorded somewhere the base URL cannot be written beside. The
// half-configured status became reachable for an environment-only project, and
// both the remedy and the record it produces were still written as though a
// committed formio.json were always there to hold it.

interface ProjectGetPayload {
  status: string;
  message: string;
  baseUrl?: string;
  shadowed?: string[];
  notes?: string[];
}

async function projectGet(
  config: FormioConfig,
  { args, serverCwd }: { args?: { cwd?: string }; serverCwd?: string } = {}
): Promise<ProjectGetPayload> {
  const client = await connectTools((server) =>
    registerProjectGetTool(server, config, serverCwd ? { cwd: () => serverCwd } : {})
  );
  const result = await client.callTool({ name: 'project_get', arguments: args ?? {} });
  const { structuredContent } = result as unknown as { structuredContent: ProjectGetPayload };
  return structuredContent;
}

// The remedy said, unconditionally, "add a `baseUrl` key beside `projectUrl` in
// the committed formio.json". For a project that resolves only from
// FORMIO_PROJECT_URL there is no such file — and a file holding `baseUrl` alone
// is not an incomplete configuration, it is an UNUSABLE one: findCommittedConfig
// claims it (it names one of the two keys) and then throws
// CommittedConfigUnusableError. Following the printed remedy therefore moved the
// directory from half-configured to a hard tool error, whose own instruction to
// every skill is "relay and stop".
describe('the base-URL remedy names the record that actually holds the project', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-base-record-'));
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('does not send an environment-only project to a formio.json that does not exist', async () => {
    const report = await projectGet(
      { projectUrl: 'https://myproject.mysite.com' },
      { args: { cwd: repo } }
    );

    expect(report.status).toBe('base-url-unresolved');
    expect(report.message).not.toMatch(/beside `?"?projectUrl/i);
    // It names where the project IS recorded instead, so the user's next move is
    // about a record that exists.
    expect(report.message).toMatch(/FORMIO_PROJECT_URL/);
  });

  it('still offers the committed file when the committed file is what names the project', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      `${JSON.stringify({ projectUrl: 'https://myproject.mysite.com' }, null, 2)}\n`
    );

    const report = await projectGet({}, { args: { cwd: repo } });

    expect(report.status).toBe('base-url-unresolved');
    // The edit that records the pair in the file that holds the project — named by
    // exact path and key, because this server never writes a committed file.
    expect(report.message).toContain(path.join(repo, 'formio.json'));
    expect(report.message).toMatch(/"baseUrl"/);
  });

  it('gives the shell reader the same answer', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-base-record-cli-'));
    try {
      const result = runProjectCommand(['project', 'get', '--cwd', repo], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      });

      expect(result.exitCode).toBe(EXIT_BASE_URL_UNRESOLVED);
      expect(result.stderr).not.toMatch(/beside `?"?projectUrl/i);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});

// resolveProject suppresses its "no cwd was passed" note when the project came
// from the environment, because an environment-sourced project resolves
// identically for every directory — the fallback directory is not part of that
// answer. reportProject reintroduced the note unconditionally, so a bundle launch
// configured purely by environment got a caution prepended to an answer that was
// in fact correct everywhere, and the skills relay notes to the user as causes.
describe('the fallback-directory note fires only where the directory decided anything', () => {
  it('stays silent for a project the environment answers for everywhere', async () => {
    const report = await projectGet(
      { projectUrl: 'https://examples.form.io' },
      { serverCwd: '/workspace/never-passed' }
    );

    expect(report.status).toBe('ok');
    expect((report.notes ?? []).join('\n')).not.toMatch(/No cwd argument was passed/);
  });

  it('still fires when the fallback directory is what supplied the project', async () => {
    const serverCwd = '/workspace/fallback-decided';
    writeProjectEntry({ cwd: serverCwd, env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' } });

    const report = await projectGet({}, { serverCwd });

    expect(report.status).toBe('ok');
    expect((report.notes ?? []).join('\n')).toMatch(/No cwd argument was passed/);
  });

  // And it fires for a half-configured answer whatever supplied the project,
  // because THAT answer's remedy records a per-directory mapping: the project may
  // resolve the same everywhere, but the base URL is about to be written under one
  // directory, and the server's own is the one directory writing it under does not
  // help. Silent, the remedy named that directory as though the caller had chosen
  // it, and the next call — which does pass a cwd — is half-configured again.
  it('fires for a half-configured answer even when the environment supplied the project', async () => {
    const report = await projectGet(
      { projectUrl: 'https://myproject.mysite.com' },
      { serverCwd: '/workspace/unresolved-fallback' }
    );

    expect(report.status).toBe('base-url-unresolved');
    expect((report.notes ?? []).join('\n')).toMatch(/No cwd argument was passed/);
    expect((report.notes ?? []).join('\n')).toContain('/workspace/unresolved-fallback');
  });

  it('warns in the message itself, beside the remedy that names that directory', async () => {
    const report = await projectGet(
      { projectUrl: 'https://myproject.mysite.com' },
      { serverCwd: '/workspace/unresolved-fallback' }
    );

    expect(report.message).toContain('BEFORE recording anything');
  });

  it('says nothing of the kind when the caller named the directory', async () => {
    const report = await projectGet(
      { projectUrl: 'https://myproject.mysite.com' },
      { args: { cwd: '/workspace/named-directory' } }
    );

    expect(report.status).toBe('base-url-unresolved');
    expect(report.message).not.toContain('BEFORE recording anything');
    expect((report.notes ?? []).join('\n')).not.toMatch(/No cwd argument was passed/);
  });
});

// formio-mcp-setup relays this output verbatim, so the order of its lines is part of
// the answer. The committed-shadow paragraph sat between `Project URL:` and
// `Base URL:`, which pushed the deployment below a blank line and a prose note and
// left it reading as part of that note.
describe('the order of the lines project set prints', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-lineorder-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-lineorder-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps the two URLs together, above the note about the committed file', () => {
    const result = runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://mapped.mysite.com',
        '--base-url',
        'https://api.mysite.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

    const lines = result.stdout.split('\n');
    const baseUrlLine = lines.findIndex((line) => line.startsWith('Base URL:'));
    const noteLine = lines.findIndex((line) => line.startsWith('Note:'));

    expect(baseUrlLine).toBeGreaterThan(-1);
    expect(noteLine).toBeGreaterThan(baseUrlLine);
  });
});

// The header and the `Project URL:` line are what formio-mcp-setup relays, so they
// have to describe THIS call. The line printed the governing project — which a
// shadowed write did not record — and the header said "Project set" even when the
// planner found nothing to write.
describe('what project set claims it did', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-claims-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-claims-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const set = () =>
    runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://mapped.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

  // The two-column pair names what RESOLVES, in both subcommands, so a user running
  // `set` and then `get` over one directory reads one answer twice. It used to name the
  // record instead — which is the caller's own argument, and told them nothing — while
  // `get` named the governing pair, so the two halves of one tool disagreed about one
  // directory. What this call recorded is named in the note below it, which is where a
  // value that is NOT in effect belongs.
  it('names what resolves, and names the record it wrote in the note', () => {
    const result = set();

    expect(result.stdout).toContain('Project URL: https://committed.mysite.com');
    expect(result.stdout).toContain('https://mapped.mysite.com');
    expect(result.stdout.split('\n')[0]).toMatch(/recorded/i);
  });

  it('says nothing was written when nothing was', () => {
    set();

    const again = set();

    expect(again.stdout.split('\n')[0]).toMatch(/no change/i);
  });
});

// The committed-shadow note describes a mapping "just written". Gated on the shadow
// alone, it also printed under `No change for <dir>`, where nothing was written —
// two adjacent lines contradicting each other, relayed to the user verbatim.
describe('the committed-shadow note on a call that wrote nothing', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-shadownote-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-shadownote-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const set = () =>
    runProjectCommand(
      [
        'project',
        'set',
        '--project-url',
        'https://mapped.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
        '--cwd',
        repo,
      ],
      { cacheDir, env: {} }
    );

  it('is printed on the write it describes', () => {
    expect(set().stdout).toMatch(/outranks this directory's mapping/);
  });

  // Printed either way now: a committed file governs whether or not this call wrote
  // anything, so a repeated call that said nothing reported the wrong active project.
  it('is printed again when nothing was written', () => {
    set();

    expect(set().stdout).toMatch(/outranks this directory's mapping/);
  });
});

// A committed file that outranks the mapping governs whether or not this call wrote
// anything, so suppressing the note on the unchanged outcome reported the mapped
// project as active when it is not. The note stays; only its tense changes.
describe('the committed-shadow note on a repeated call', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-shadowagain-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-shadowagain-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const set = () =>
    runProjectCommand(
      ['project', 'set', '--project-url', 'https://mapped.form.io', '--cwd', repo],
      { cacheDir, env: {} }
    );

  it('still says which project governs when nothing was written', () => {
    set();

    const again = set();

    expect(again.stdout).toContain('https://committed.form.io');
    expect(again.stdout).not.toMatch(/just written/);
  });

  it('names the project that governs instead of the one just recorded', () => {
    expect(set().stdout).toMatch(/https:\/\/committed\.form\.io is the active project/);
  });
});
