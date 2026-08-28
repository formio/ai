import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_CLI } from '../cli-launch.js';
import { runProjectCommand } from '../cli/project-command.js';

// The property no test on this surface has ever asserted: RUN what the report printed,
// and check the directory then resolves.
//
// Every earlier defect of the "remedy that cannot be acted on" kind survived a suite
// that asserted the wording of a message and the behaviour of a writer separately.
// Neither assertion is wrong; the gap between them is where a report told the caller
// to run a command that exits 2. This closes the gap by treating the printed remedy as
// executable: extract it, fill in the values a user would supply, run it, and require
// exit 0 from the `project get` that follows.
describe('the remedy a report prints is a command that resolves the directory', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-remedy-run-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-remedy-run-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  // What a user supplies when the report asks. Everything else in the command is
  // already filled in by the server, which is the point of printing it.
  const ANSWERS: Record<string, string> = {
    '<project_url>': 'https://myproject.mysite.com',
    '<base_url>': 'https://api.mysite.com',
    // The unconfigured remedy asks for a Project URL alone, so the answer here is a
    // shape that names its own deployment. The other shape needs a second value, which
    // that message has to say up front — asserted separately below.
    '<url>': 'https://examples.form.io',
  };

  const commandsIn = (output: string, answers: Record<string, string> = {}): string[][] =>
    output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes(`${PROJECT_CLI} set`))
      .map((line) => line.slice(line.indexOf(PROJECT_CLI)))
      .map((line) =>
        line
          .split(/\s+/)
          .slice(PROJECT_CLI.split(/\s+/).length - 1)
          .map((token) => answers[token] ?? ANSWERS[token] ?? token)
      );

  const runRemedy = (
    output: string,
    env: NodeJS.ProcessEnv = {},
    answers: Record<string, string> = {}
  ) => {
    const [command] = commandsIn(output, answers);
    expect(command, `no runnable remedy in:\n${output}`).toBeDefined();
    return runProjectCommand(command, { cacheDir, env });
  };

  const get = (env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });

  // Exit 0 is not the property. A remedy that runs and leaves the directory resolving
  // something other than what the user supplied is worse than one that fails, so the
  // resolved PAIR is what gets asserted — and the fixtures below use values distinct
  // from the answers, so a deployment carried from whatever was already there cannot
  // pass as the one that was typed.
  const resolvesAfterItsOwnRemedy = (
    env: NodeJS.ProcessEnv,
    expected: { projectUrl: string; baseUrl: string }
  ) => {
    const report = get(env);
    expect(report.exitCode, 'expected a report with a remedy').not.toBe(0);

    const applied = runRemedy(report.stdout + report.stderr, env);
    expect(applied.exitCode, `remedy failed:\n${applied.stderr}`).toBe(0);

    const after = get(env);
    expect(after.exitCode, `still unresolved:\n${after.stderr}`).toBe(0);
    expect(after.stdout, `resolved the wrong pair:\n${after.stdout}`).toContain(
      `Project URL: ${expected.projectUrl}`
    );
    expect(after.stdout, `resolved the wrong pair:\n${after.stdout}`).toContain(
      `Base URL:    ${expected.baseUrl}`
    );
    return after;
  };

  const mapEntry = () => {
    const file = path.join(cacheDir, 'projects.json');
    if (!fs.existsSync(file)) {
      return undefined;
    }
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)[repo];
  };

  it('resolves a directory with nothing configured', () => {
    resolvesAfterItsOwnRemedy(
      {},
      { projectUrl: 'https://examples.form.io', baseUrl: 'https://api.form.io' }
    );
  });

  // The unset-project message asks for ONE value, so the shape that names no
  // deployment is answered by the refusal that follows — which has to print its own
  // runnable command, or the user is left one step short with an error.
  it('completes the configuration when the answer needs a second value', () => {
    const report = get();
    expect(report.exitCode).toBe(1);

    const refused = runRemedy(report.stderr, {}, { '<url>': 'https://myproject.mysite.com' });
    expect(refused.exitCode).toBe(1);

    const applied = runRemedy(refused.stderr);
    expect(applied.exitCode, `second step failed:\n${applied.stderr}`).toBe(0);
    expect(get().exitCode).toBe(0);
  });

  it('resolves a project mapped without a derivable deployment', () => {
    // The mapping holds the pair, then loses its deployment the way a hand edit would.
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' } } })
    );

    resolvesAfterItsOwnRemedy(
      {},
      { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' }
    );
  });

  // A committed project's remedy is an EDIT — this command never writes that file —
  // so the executable form of the property is: the report names the exact file and
  // key, and performing that edit resolves the pair.
  it('resolves a project held by a committed formio.json after the edit it names', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );

    const report = get();
    expect(report.exitCode).toBe(3);
    expect(report.stderr).toContain(path.join(repo, 'formio.json'));
    expect(report.stderr).toMatch(/"baseUrl"/);

    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      })
    );

    const after = get();
    expect(after.exitCode, after.stderr).toBe(0);
    expect(after.stdout).toContain('Project URL: https://myproject.mysite.com');
    expect(after.stdout).toContain('Base URL:    https://api.mysite.com');
  });

  it('resolves a project held only by the environment', () => {
    resolvesAfterItsOwnRemedy(
      { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' }
    );
  });

  // The shape a released version wrote: a deployment recorded for a project that lives
  // in another record. The pair rule cannot read it, so the report has to say so and
  // its remedy has to clear it.
  it('resolves a directory holding a deployment with no project', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    // Deliberately NOT the value the remedy is answered with: a deployment carried from
    // this stranded record must not be able to pass as the one supplied.
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } } })
    );

    resolvesAfterItsOwnRemedy(
      { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' }
    );

    // And the record that stranded it is gone, not left to be reported forever.
    expect(mapEntry()).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://api.mysite.com',
      },
    });
  });

  it('names the stranded deployment rather than ignoring it', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } } })
    );

    const report = get({ FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });

    expect(report.stderr).toContain('https://stranded.mysite.com');
  });

  // The same stranded record under a COMMITTED project: that remedy edits the file and
  // cannot clear the mapping, so the report must not claim it does.
  it('does not claim to replace an entry its remedy never touches', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } } })
    );

    const report = get();
    expect(report.stderr).toContain('https://stranded.mysite.com');
    expect(report.stderr).not.toMatch(/replaces it/);

    // Perform the edit the report names.
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      })
    );
    expect(get().exitCode).toBe(0);
    // Still there — which is why the note must not have promised otherwise.
    expect(mapEntry()).toEqual({ env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } });
  });

  // The same property for what the WRITER prints. This file drove `project get` only, so
  // a refusal reachable only from `project set` was outside it — and one of them printed
  // a command that cannot run: it asked for a Project URL and a Base URL together, which
  // both derivable project shapes refuse, while the Project URL alone succeeds. The
  // reader's message for the very same state already named the working repair.
  describe('a remedy printed by the writer', () => {
    const setBaseUrlAlone = () =>
      runProjectCommand(['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo], {
        cacheDir,
        env: {},
      });

    beforeEach(() => {
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({ [repo]: { env: { FORMIO_PROJECT_URL: 'ftp://broken.mysite.com' } } })
      );
    });

    it('runs, and leaves the directory resolving', () => {
      const refusal = setBaseUrlAlone();
      expect(refusal.exitCode, 'expected a refusal to act on').not.toBe(0);

      const applied = runRemedy(
        refusal.stdout + refusal.stderr,
        {},
        {
          '<project_url>': 'https://examples.form.io',
        }
      );

      expect(applied.exitCode, `the remedy it printed failed:\n${applied.stderr}`).toBe(0);
      expect(get().exitCode, `still unresolved:\n${get().stderr}`).toBe(0);
    });

    // The value it is replacing lives nowhere else, so the refusal has to hand it back.
    it('quotes the value it is about to replace', () => {
      expect(setBaseUrlAlone().stderr).toContain('ftp://broken.mysite.com');
    });
  });
});
