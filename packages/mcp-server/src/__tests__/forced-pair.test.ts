import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_CLI } from '../cli-launch.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

/**
 * `project set --force` records a pair the domain rules would refuse.
 *
 * Every other rule on this surface exists because a wrong pair fails later as
 * unexplained 404s or a portal login sent to a deployment the user does not have. One
 * shape is not wrong, though, and cannot be told apart from the wrong one by looking at
 * the URLs: an internal deployment served from a *.form.io domain, which QA tests. The
 * hosted-cloud rule says a form.io host is served by https://api.form.io and by nothing
 * else, and for that deployment it is false.
 *
 * So the override is explicit, typed by a developer at a shell, and it records the pair
 * as FORCED — because the reader applies the same rules at the point of use, and a
 * record that is only accepted by the writer is refused on the next call.
 *
 * Two properties hold it to a narrow shape: `--force` needs BOTH halves in the same
 * call (a forced record is never half a pair, and never derives), and force is a
 * property of the pair that was forced — re-pointing the directory at a different
 * project drops it, and the ordinary rules apply again.
 *
 * What does NOT clear it is re-recording the same pair without the flag: the pair is
 * unchanged, so the override is unchanged, and an agent's ordinary re-statement of the
 * project cannot undo a developer's decision. `project set --reset` is how the record
 * is cleared, and every message that mentions the override names it.
 */
describe('a forced project/deployment pair', () => {
  // The QA shape: a project on a *.form.io domain served by an internal deployment.
  const PROJECT = 'https://qa.form.io';
  const DEPLOYMENT = 'https://api.qa.internal.example';

  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-forced-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-forced-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    // The tools key on the real cache directory, which setup.ts points at a per-worker
    // temporary HOME.
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const set = (argv: string[]) =>
    runProjectCommand(['project', 'set', ...argv, '--cwd', repo], { cacheDir, env: {} });

  const get = () => runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

  const entry = (dir: string = cacheDir): unknown => {
    const file = path.join(dir, 'projects.json');
    if (!fs.existsSync(file)) {
      return undefined;
    }
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)[repo];
  };

  // The one phrase every clear prints, whatever the entry held.
  const cleared = () => `Cleared the mapping for ${repo}`;

  const seedTool = (value: unknown) => {
    const dir = path.join(os.homedir(), '.formio');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify({ [repo]: value }));
  };

  interface ToolRead {
    status?: string;
    projectUrl?: string;
    baseUrl?: string;
    forced?: boolean;
    output: string;
  }

  const readTool = async (): Promise<ToolRead> => {
    const client = await connectTools((server) =>
      registerProjectGetTool(server, {}, { cwd: () => repo })
    );
    const result = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as {
      content: Array<{ text: string }>;
      structuredContent?: {
        status?: string;
        projectUrl?: string;
        baseUrl?: string;
        forced?: boolean;
      };
    };
    return {
      ...result.structuredContent,
      output: result.content.map((item) => item.text).join('\n'),
    };
  };

  describe('the pair the hosted-cloud rule refuses', () => {
    it('is refused without --force', () => {
      const result = set(['--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      expect(result.exitCode, result.stdout).not.toBe(0);
      expect(result.stderr).toContain('https://api.form.io');
      expect(entry(), 'recorded a pair it refused').toBeUndefined();
    });

    it('is recorded with --force', () => {
      const result = set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(`Project URL: ${PROJECT}`);
      expect(result.stdout).toContain(`Base URL:    ${DEPLOYMENT}`);
    });

    // The point of the whole feature: the reader applies the same rules at the point of
    // use, so a pair only the writer accepts is refused on the next call — and the
    // deployment a forced record names must not be replaced by the derived one.
    it('resolves as recorded on the next read', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      const report = get();

      expect(report.exitCode, report.stderr).toBe(0);
      expect(report.stdout).toContain(`Project URL: ${PROJECT}`);
      expect(report.stdout).toContain(`Base URL:    ${DEPLOYMENT}`);
      expect(report.stdout, 'derived the hosted cloud over the forced deployment').not.toContain(
        'https://api.form.io'
      );
    });

    it('says the pair was forced, so the skipped checks are not a mystery', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      expect(get().stdout).toMatch(/forced/i);
    });

    it('is written to the mapping as forced', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      expect(entry()).toEqual({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });
    });
  });

  // Not just the hosted-cloud rule: `--force` is the developer taking responsibility
  // for the pair, so every verdict of the pair rule is skipped. One rule, no list of
  // exceptions to keep in step with the classifier.
  it('records a project URL the pair rule refuses outright', () => {
    const result = set([
      '--force',
      '--project-url',
      'https://api.form.io',
      '--base-url',
      'https://api.internal.example',
    ]);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(get().exitCode, get().stderr).toBe(0);
  });

  describe('--force without both halves', () => {
    it('is refused with only a project URL', () => {
      const result = set(['--force', '--project-url', PROJECT]);

      expect(result.exitCode, result.stdout).not.toBe(0);
      expect(result.stderr).toContain('--base-url');
      expect(entry()).toBeUndefined();
    });

    it('is refused with only a base URL', () => {
      set(['--project-url', 'https://examples.form.io']);

      const result = set(['--force', '--base-url', DEPLOYMENT]);

      expect(result.exitCode, result.stdout).not.toBe(0);
      expect(result.stderr).toContain('--project-url');
      expect(get().stdout, 'changed the record it refused to force').toContain(
        'Base URL:    https://api.form.io'
      );
    });
  });

  describe('the tools, which cannot force anything themselves', () => {
    it('read a forced record as ok', async () => {
      seedTool({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });

      const report = await readTool();

      expect(report.status, report.output).toBe('ok');
      expect(report.projectUrl).toBe(PROJECT);
      expect(report.baseUrl).toBe(DEPLOYMENT);
      expect(report.forced).toBe(true);
    });

    // An agent re-stating the project it already resolved is an ordinary call, and it
    // must not quietly undo a developer's override: the pair is unchanged, so what was
    // forced about it is unchanged too.
    it('keep the override when project_set re-states the same pair', async () => {
      seedTool({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });
      const client = await connectTools((server) =>
        registerProjectSetTool(server, { cwd: () => repo })
      );

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd: repo, projectUrl: PROJECT },
      })) as unknown as {
        isError?: boolean;
        content: Array<{ text: string }>;
        structuredContent?: { ok?: boolean; baseUrl?: string };
      };
      const output = result.content.map((item) => item.text).join('\n');

      expect(result.isError, output).toBeFalsy();
      expect(result.structuredContent?.baseUrl, output).toBe(DEPLOYMENT);
      expect(entry(path.join(os.homedir(), '.formio'))).toEqual({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });
    });

    // The pair this result reports is one the rules forbid, so the result has to
    // account for it. Silent, `project_set` answers an agent with a hosted project on
    // a deployment its own refusals call impossible, and the agent's next move is to
    // "correct" a record a developer set deliberately.
    it('say the pair is forced rather than reporting it bare', async () => {
      seedTool({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });
      const client = await connectTools((server) =>
        registerProjectSetTool(server, { cwd: () => repo })
      );

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd: repo, projectUrl: PROJECT },
      })) as unknown as {
        content: Array<{ text: string }>;
        structuredContent?: { forced?: boolean };
      };
      const output = result.content.map((item) => item.text).join('\n');

      expect(result.structuredContent?.forced, output).toBe(true);
      expect(output).toMatch(/--force/);
    });
  });

  // Force belongs to the pair, not to the directory. Re-pointing at another project is
  // a new pair nobody has vouched for, so the ordinary rules decide it again.
  it('is dropped when the directory is re-pointed at another project', () => {
    set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

    const result = set(['--project-url', 'https://examples.form.io']);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(entry()).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://examples.form.io',
        FORMIO_BASE_URL: 'https://api.form.io',
      },
    });
  });

  it('does not survive an unforced write of a different deployment', () => {
    set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

    const result = set(['--base-url', 'https://api.other.example']);

    expect(result.exitCode, result.stdout).not.toBe(0);
    expect(entry(), 'accepted an unforced pair the rules refuse').toEqual({
      env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
      forced: true,
    });
  });

  // The way out. Force is preserved for an unchanged pair, so "record it again without
  // --force" cannot be the way back — that call reports no change and leaves the
  // override in place. `--reset` clears the directory's record; what is recorded next
  // is judged by the ordinary rules, because nothing is left to preserve.
  describe('project set --reset', () => {
    it('clears the record, and says what was cleared', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      const result = set(['--reset']);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(PROJECT);
      expect(result.stdout).toContain(DEPLOYMENT);
      expect(entry()).toBeUndefined();
    });

    it('leaves the directory resolving nothing when it held the only record', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
      set(['--reset']);

      const report = get();

      expect(report.exitCode).toBe(1);
      expect(report.stderr).toMatch(/No Form\.io project is configured/);
    });

    // The property the whole flag exists for: after the reset the pair is refused
    // again, so the checks genuinely apply rather than being waived forever.
    it('puts the checks back for the pair that was forced', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
      set(['--reset']);

      const result = set(['--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      expect(result.exitCode, result.stdout).not.toBe(0);
      expect(result.stderr).toContain('https://api.form.io');
    });

    it('leaves the directory recordable without --force', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
      set(['--reset']);

      const result = set(['--project-url', 'https://examples.form.io']);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(entry()).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://examples.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
      });
    });

    it('is idempotent on a directory that holds no record', () => {
      const result = set(['--reset']);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/nothing to clear|no mapping/i);
    });

    // Clearing a record and recording one are opposite requests, and a call that says
    // both says nothing. Refused as a usage error rather than resolved by an order of
    // precedence nobody can see.
    it.each([
      ['a project URL', ['--reset', '--project-url', PROJECT]],
      ['a base URL', ['--reset', '--base-url', DEPLOYMENT]],
      [
        '--force and a pair',
        ['--reset', '--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT],
      ],
    ])('is refused beside %s', (_label, argv) => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);

      const result = set(argv as string[]);

      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.stderr).toContain('--reset');
      expect(entry(), 'cleared or rewrote the record it refused to act on').toEqual({
        env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
        forced: true,
      });
    });

    // The entry it removes is UNVALIDATED — a malformed one is exactly the kind this
    // clears — so what it held is read defensively. Read as a well-formed entry, the
    // clear landed on disk and the command then died formatting its own success
    // message: exit 2, no report, and the documented two-step repair broken at step
    // one for the state most likely to need it.
    it('reports the clear even when the entry it removed was malformed', () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({ [repo]: 'https://qa.form.io' })
      );

      const result = set(['--reset']);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(cleared());
      expect(entry()).toBeUndefined();
    });

    // It clears the MAPPING, which is the only record this command writes. A committed
    // file is not this command's to remove, so the directory it governs still resolves.
    it('does not touch a committed formio.json', () => {
      set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
      fs.writeFileSync(
        path.join(repo, 'formio.json'),
        JSON.stringify({ projectUrl: 'https://committed.form.io' })
      );

      const result = set(['--reset']);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(entry()).toBeUndefined();
      expect(get().stdout).toContain('Project URL: https://committed.form.io');
    });
  });

  // A forced report explains itself, and the explanation names a command. Run what it
  // printed: the record clears, and the directory is then recordable by the ordinary
  // rules. Asserted as an executable chain rather than as wording, because the message
  // this replaces named a command that reported "no change" and changed nothing.
  it('names a way out that runs', () => {
    set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
    const report = get();

    const printed = (report.stdout + report.stderr)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.includes('project set') && line.includes('--reset'));
    expect(printed, `no reset command in:\n${report.stdout}`).toBeDefined();
    const argv = (printed as string).slice((printed as string).indexOf('project set')).split(/\s+/);

    const applied = runProjectCommand(argv, { cacheDir, env: {} });

    expect(applied.exitCode, `the printed command failed:\n${applied.stderr}`).toBe(0);
    expect(entry()).toBeUndefined();
  });

  // Force needs both halves, and the reader enforces that by ignoring the flag on a
  // record holding one. The writer has to agree: reading the flag off a project-only
  // entry made it skip the verdict that entry's own project URL fails, and answer with
  // a demand for a Base URL for a URL that is not a project at all.
  it('is ignored by the writer on a record holding no deployment', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({
        [repo]: { env: { FORMIO_PROJECT_URL: 'https://portal.form.io' }, forced: true },
      })
    );

    const result = set(['--project-url', 'https://portal.form.io']);

    expect(result.exitCode, result.stdout).not.toBe(0);
    expect(result.stderr, 'skipped the verdict this project URL fails').toMatch(
      /not a Form\.io project URL/
    );
  });

  // A forced write under a committed formio.json lands on disk and does not take
  // effect: that file supplies the pair the directory resolves. The write is still
  // worth making — the mapping is the fallback if the file goes away — but silence
  // about it is the same trap the hosted-cloud refusal suppresses its own --force hint
  // to avoid, reached by a developer who followed the documentation instead.
  it('says a forced write does not take effect while a committed file governs', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );

    const result = set(['--force', '--project-url', PROJECT, '--base-url', DEPLOYMENT]);
    const output = result.stdout + result.stderr;

    expect(output, 'never said the pair was forced').toMatch(
      /recorded with --force|pair was forced|forced pair/i
    );
    expect(output).toMatch(/does not take effect|is the active project/);
  });

  // `--force` with no URLs at all is answered by the FORCE rule, not by the generic
  // one: "pass at least one of them" is true of an ordinary write and false here, so it
  // sent the reader into a second refusal on their next attempt.
  it('asks for both halves when --force arrives with no URLs', () => {
    const result = set(['--force']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('--project-url');
    expect(result.stderr).toContain('--base-url');
    expect(result.stderr, 'offered a one-URL call, which --force refuses').not.toMatch(
      /at least one of/
    );
  });

  // The reset is a destructive command, and the two readers of this report are not the
  // same party: a developer at a shell can be handed it to run, and an agent running
  // project_get as a routine preflight must not be — acting on it wipes an override it
  // was never asked to touch, and --reset exits 0, so the agent reports success.
  it('does not hand the agent a runnable reset command', async () => {
    seedTool({
      env: { FORMIO_PROJECT_URL: PROJECT, FORMIO_BASE_URL: DEPLOYMENT },
      forced: true,
    });

    const report = await readTool();

    expect(report.output, 'the report explains the override').toMatch(
      /recorded with --force|deliberate override/i
    );
    expect(report.output, 'handed an agent a runnable destructive command').not.toContain(
      `${PROJECT_CLI} set --reset`
    );
    expect(report.output, 'did not name the flag the user needs').toContain('--reset');
  });

  // The override is a machine-local mapping written by a developer at a shell. A
  // committed formio.json is shared with everyone who clones the repository, so a
  // `force` key there is not this feature — it is ignored like any other unknown key,
  // and the pair rule decides that file as it always has.
  it('is not something a committed formio.json can claim', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: PROJECT, baseUrl: DEPLOYMENT, force: true })
    );

    const report = get();

    expect(report.stdout).toContain('Base URL:    https://api.form.io');
    expect(report.stderr).toMatch(/Ignoring the Base URL/);
  });
});
