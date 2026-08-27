import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_CLI } from '../cli-launch.js';
import { runProjectCommand, type ProjectCommandResult } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

/**
 * One property over EVERY failing state this surface can reach: acting on what the
 * message says makes progress.
 *
 * The per-state tests each pick a state and check the command it prints. That is not
 * this property, and the gap between them is where this surface has failed five
 * separate times: a message whose named command IS the command that just failed, a
 * message promising a write it does not name, a message re-using the fatal case's
 * remedy on a path where nothing is broken. Every one of those passes a per-state
 * test while leaving the caller with nothing to do.
 *
 * Three checks, applied to each row of one table:
 *
 *  1. NON-LOOPING — a named command is never the command that produced the message.
 *  2. PROGRESS — after acting on the message, the DIRECTORY resolves differently.
 *     Measured with `project get` rather than by re-running the probe, because a
 *     remedy may legitimately fix the directory while leaving the refused call still
 *     refused — recording a deployment in a committed file does not make a mapping
 *     write correct.
 *  3. HONESTY — a message that names no automatic fix says what a human must do, and
 *     a message that promises one "below" actually carries it.
 *
 * Adding a row is how a new failure mode gets covered; the checks never change.
 */

interface ProbeRun {
  result: ProjectCommandResult;
  /** What the probe actually ran, so the non-looping check compares against fact. */
  argv: string[];
}

interface Context {
  repo: string;
  cacheDir: string;
  env: NodeJS.ProcessEnv;
}

interface Scenario {
  name: string;
  setup: (context: { repo: string; cacheDir: string }) => void;
  env?: NodeJS.ProcessEnv;
  probe: (context: Context) => ProbeRun;
  /**
   * A state a human must repair before any command can run. Its message must SAY so,
   * and any command it names must genuinely still fail — a message sending someone to
   * repair a file by hand when a command would have worked costs more than none.
   */
  manualRepairFirst?: boolean;
}

// What a user supplies when a remedy asks, chosen distinct from every fixture value
// so a deployment carried from an existing record cannot pass as one typed now.
const ANSWERS: Record<string, string> = {
  '<project_url>': 'https://answered.mysite.com',
  '<base_url>': 'https://api.answered.mysite.com',
  '<url>': 'https://answered.form.io',
};

interface NamedCommand {
  tokens: string[];
  /**
   * Whether the message left a value for the USER to fill in.
   *
   * It decides how strictly the command is judged. A command the server printed with
   * every value already known must be ACCEPTED — naming a call it knows will be
   * refused is the defect. A command carrying a placeholder cannot be held to that:
   * the server could not know which shape the user would type, so a refusal asking
   * for a second value (a path-less project URL derives no deployment) is a correct
   * next round rather than a dead end.
   */
  hadPlaceholder: boolean;
}

const commandsIn = (output: string): NamedCommand[] =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(`${PROJECT_CLI} set`))
    .map((line) => line.slice(line.indexOf(PROJECT_CLI)))
    .map((line) => {
      const raw = line
        .replace(/[.,]$/, '')
        .split(/\s+/)
        .slice(PROJECT_CLI.split(/\s+/).length - 1);
      return {
        tokens: raw.map((token) => ANSWERS[token] ?? token),
        hadPlaceholder: raw.some((token) => token in ANSWERS),
      };
    })
    // The USAGE synopsis brackets every flag. It is a reference, not a remedy.
    .filter(({ tokens }) => !tokens.some((token) => token.startsWith('[')));

/** Says a human has to act before any command can work. */
const saysManualRepairFirst = (output: string) =>
  /Repair or delete that file FIRST|Fix that file|dit (it|that file) directly|by hand/i.test(
    output
  );

/**
 * Says the next step is a value only the user can give.
 *
 * That terminates as surely as a command does — the loop ends because the answer
 * changes, not because the server acts. What a message must never do is stay silent,
 * leaving the caller unable to tell whether anything can be done at all.
 */
const asksTheUserForAValue = (output: string) =>
  /Ask the user|Point this directory at|ask for the Base URL/i.test(output);

/**
 * The fix is an edit to a named file rather than a call.
 *
 * Anchored to the SENTENCE that instructs the edit. Scanning the whole output for
 * the first `formio.json` path and the first quoted key matched the leading NOTES
 * instead — a file the walk passed over, named in prose that quotes "projectUrl" to
 * explain why — so the harness happily wrote a fabricated project into a file the
 * server disowns and counted the resulting change as progress.
 */
const namedFileEdit = (
  output: string
): { filePath: string; key: string; value?: string } | undefined => {
  const sentence = output
    .split(/(?<=\.)\s+/)
    .find((part) => /(?:Add|add) "(?:baseUrl|projectUrl)"/.test(part));
  if (!sentence) {
    return undefined;
  }
  const key = sentence.match(/(?:Add|add) "(baseUrl|projectUrl)"/)?.[1];
  // The path is either in that sentence, or named earlier as `formio.json at <path>`
  // when the sentence says "in that file". Never taken from anywhere else.
  const filePath =
    sentence.match(/(\/[^\s"']*formio\.json)/)?.[1] ??
    output.match(/formio\.json at (\/[^\s"',]+)/)?.[1];
  // The value the message tells the user to write, where it names one.
  const value = sentence.match(/(?:Add|add) "(?:baseUrl|projectUrl)": "(https?:[^"]+)"/)?.[1];
  return filePath && key ? { filePath, key, ...(value ? { value } : {}) } : undefined;
};

// The helper this table relies on, pinned directly: it once matched the first
// formio.json path and first quoted key ANYWHERE in the output, which in practice
// meant the leading notes — a file the walk passed over, described in prose that
// quotes "projectUrl" to explain why it was skipped. The table then wrote a
// fabricated project into a file the server disowns and counted the change as
// progress.
describe('the named-edit reader takes the file the remedy names', () => {
  const message = [
    'Ignoring /repo/app/formio.json: it holds neither "projectUrl" nor "baseUrl", so it is not a Form.io project configuration.',
    'Project URL: https://myproject.mysite.com',
    'Add "baseUrl": "https://api.mysite.com" beside "projectUrl" in /repo/formio.json — the committed file that holds this project.',
  ].join('\n');

  it('ignores a path named only by a passing note', () => {
    expect(namedFileEdit(message)).toEqual({
      filePath: '/repo/formio.json',
      key: 'baseUrl',
      value: 'https://api.mysite.com',
    });
  });

  it('finds the file named earlier when the instruction says "that file"', () => {
    const indirect = [
      "https://myproject.mysite.com is recorded in the committed formio.json at /repo/formio.json, not in this directory's mapping.",
      'Add "baseUrl": "https://api.mysite.com" beside "projectUrl" in that file — edit that file directly.',
    ].join(' ');

    expect(namedFileEdit(indirect)?.filePath).toBe('/repo/formio.json');
  });

  it('reads no edit from a message that instructs none', () => {
    expect(
      namedFileEdit('Ignoring /repo/app/formio.json: it holds neither "projectUrl" nor "baseUrl".')
    ).toBeUndefined();
  });
});

describe('every failing state names something that makes progress', () => {
  let repo: string;
  let cacheDir: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-terminate-repo-'));
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-terminate-cache-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  // Every URL this row put into the world — in a record, or in the call itself. An
  // answer that names none of them is describing the caller's situation in the
  // abstract, which is the shape a message takes when a value it meant to name came
  // out `undefined`.
  let stateUrls: string[] = [];
  const remember = (values: Record<string, string>) => {
    stateUrls.push(...Object.values(values).filter((value) => value.includes('://')));
  };

  const seed = (dir: string, env: Record<string, string>) => {
    remember(env);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [dir]: { env } }));
  };
  const commit = (dir: string, config: Record<string, string>) => {
    remember(config);
    fs.writeFileSync(path.join(dir, 'formio.json'), JSON.stringify(config));
  };

  const get = ({ repo: dir, cacheDir: cache, env }: Context): ProbeRun => {
    const argv = ['project', 'get', '--cwd', dir];
    return { result: runProjectCommand(argv, { cacheDir: cache, env }), argv };
  };

  const set =
    (args: () => string[]) =>
    ({ repo: dir, cacheDir: cache, env }: Context): ProbeRun => {
      const argv = ['project', 'set', ...args(), '--cwd', dir];
      return { result: runProjectCommand(argv, { cacheDir: cache, env }), argv };
    };

  const SCENARIOS: Scenario[] = [
    { name: 'nothing configured at all', setup: () => {}, probe: get },
    {
      name: 'a mapping holding a deployment with no project',
      setup: ({ repo: dir }) => seed(dir, { FORMIO_BASE_URL: 'https://stranded.mysite.com' }),
      probe: get,
    },
    {
      name: 'a committed project whose deployment cannot be derived',
      setup: ({ repo: dir }) => commit(dir, { projectUrl: 'https://myproject.mysite.com' }),
      probe: get,
    },
    {
      name: 'a mapped project whose deployment cannot be derived',
      setup: ({ repo: dir }) => seed(dir, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }),
      probe: get,
    },
    {
      name: 'an environment project whose deployment cannot be derived',
      setup: () => {},
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      probe: get,
    },
    {
      name: 'a committed file that cannot be used',
      setup: ({ repo: dir }) => commit(dir, { baseUrl: 'https://api.mysite.com' }),
      probe: get,
      manualRepairFirst: true,
    },
    {
      name: 'a map file that cannot be read',
      setup: () => {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, 'projects.json'), '{not json');
      },
      probe: get,
      manualRepairFirst: true,
    },
    {
      // The map is unreadable but a committed file answers, so the map is TOLERATED.
      // Its note must not carry the fatal case's "repair this FIRST" remedy: nothing
      // needs repairing for this answer, and the write it names would not take effect.
      name: 'an unreadable map a committed file makes irrelevant',
      setup: ({ repo: dir }) => {
        commit(dir, { projectUrl: 'https://myproject.mysite.com' });
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, 'projects.json'), '{not json');
      },
      probe: get,
    },
    {
      name: 'a mapping entry that is not an entry',
      setup: ({ repo: dir }) => {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [dir]: 'oops' }));
      },
      probe: get,
    },
    {
      name: 'a write naming a project that derives no deployment',
      setup: () => {},
      probe: set(() => ['--project-url', 'https://myproject.mysite.com']),
    },
    {
      name: 'a write naming a deployment while a committed file holds the project',
      setup: ({ repo: dir }) => commit(dir, { projectUrl: 'https://myproject.mysite.com' }),
      probe: set(() => ['--base-url', 'https://api.mysite.com']),
    },
    {
      name: 'a write naming a deployment while the environment holds the project',
      setup: () => {},
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      probe: set(() => ['--base-url', 'https://api.mysite.com']),
    },
    {
      name: 'a write naming the API root as the project',
      setup: () => {},
      probe: set(() => ['--project-url', 'https://api.form.io']),
    },
    {
      name: 'a write naming a project that is its own deployment',
      setup: () => {},
      probe: set(() => [
        '--project-url',
        'https://forms.mysite.com',
        '--base-url',
        'https://forms.mysite.com',
      ]),
    },
    {
      // The state an earlier release could write: a hosted project with a foreign
      // deployment beside it. Re-recording the SAME project inherits that stored
      // value, so the refusal must not name the call that just produced it.
      name: 're-recording a hosted project whose stored deployment is foreign',
      setup: ({ repo: dir }) =>
        seed(dir, {
          FORMIO_PROJECT_URL: 'https://examples.form.io',
          FORMIO_BASE_URL: 'https://forms.mysite.com',
        }),
      probe: set(() => ['--project-url', 'https://examples.form.io']),
    },
    {
      name: 'a write over a stranded deployment',
      setup: ({ repo: dir }) => seed(dir, { FORMIO_BASE_URL: 'https://stranded.mysite.com' }),
      probe: set(() => ['--project-url', 'https://myproject.mysite.com']),
    },
    {
      name: 'a write whose project URL is mistyped',
      setup: () => {},
      probe: set(() => ['--project-url', 'htps://examples.form.io']),
    },
    // Read-time pair-rule refusals: the half of the single chokepoint the writers do
    // not cover, and every one of them was outside this table.
    {
      name: 'a mapping entry recording the API root as its project',
      setup: ({ repo: dir }) => seed(dir, { FORMIO_PROJECT_URL: 'https://api.form.io' }),
      probe: get,
    },
    {
      name: 'a mapping entry recording one URL as both halves',
      setup: ({ repo: dir }) =>
        seed(dir, {
          FORMIO_PROJECT_URL: 'https://forms.mysite.com',
          FORMIO_BASE_URL: 'https://forms.mysite.com',
        }),
      probe: get,
    },
    {
      name: 'a committed file recording one URL as both halves',
      setup: ({ repo: dir }) =>
        commit(dir, {
          projectUrl: 'https://x.mysite.com/p',
          baseUrl: 'https://x.mysite.com/p',
        }),
      probe: get,
      manualRepairFirst: true,
    },
    // A deployment dropped because it cannot serve the project: the refusal must not
    // invite the user to re-supply the very value the rule rejects.
    {
      name: 'a write whose stored deployment cannot serve the project',
      setup: ({ repo: dir }) =>
        seed(dir, {
          FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
          FORMIO_BASE_URL: 'https://myproject.mysite.com',
        }),
      probe: set(() => ['--project-url', 'https://myproject.mysite.com']),
    },
    // A deployment offered for a project ANOTHER record holds, where the pair it
    // would form is one the resolver refuses. The refusal returns before the pair is
    // ever classified, so it instructed writing a pair that breaks the directory.
    {
      name: 'a deployment offered for a committed project it collapses onto',
      setup: ({ repo: dir }) => commit(dir, { projectUrl: 'https://forms.mysite.com/one' }),
      probe: set(() => ['--base-url', 'https://forms.mysite.com/one']),
    },
    {
      name: 'a deployment offered for a hosted project in the environment',
      setup: () => {},
      env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      probe: set(() => ['--base-url', 'https://forms.mysite.com']),
    },
    // The API root as a PROJECT, reached through the deferral rather than typed:
    // the verdict the deferral block did not handle.
    {
      name: 'a deployment offered for an API-root project in the environment',
      setup: () => {},
      env: { FORMIO_PROJECT_URL: 'https://api.form.io' },
      probe: set(() => ['--base-url', 'https://api.mysite.com']),
    },
    {
      name: 'a deployment offered for an API-root project in a committed file',
      setup: ({ repo: dir }) => commit(dir, { projectUrl: 'https://api.form.io' }),
      probe: set(() => ['--base-url', 'https://api.mysite.com']),
    },
    // A base-URL write over a mapping that holds its OWN project, while the
    // environment names another: the deferral must not judge this call against a
    // project this directory does not resolve.
    {
      name: 'a deployment for a mapped project while the environment names another',
      setup: ({ repo: dir }) => seed(dir, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }),
      env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      probe: set(() => ['--base-url', 'https://api.mysite.com']),
    },
    // A derivable project paired with a plausible-but-wrong deployment. No row
    // reached the entry points for this verdict, so the branch answering it could be
    // dropped without a single test noticing.
    {
      name: 'a write pairing a sub-directory project with the wrong parent',
      setup: () => {},
      probe: set(() => [
        '--project-url',
        'https://forms.mysite.com/one/two',
        '--base-url',
        'https://forms.mysite.com',
      ]),
    },
    // The hosted cloud offered as a CUSTOMER project's deployment — the wrong answer
    // the base-URL interview is likeliest to receive.
    {
      name: 'a write pairing a customer project with the hosted cloud',
      setup: () => {},
      probe: set(() => [
        '--project-url',
        'https://myproject.mysite.com',
        '--base-url',
        'https://api.form.io',
      ]),
    },
    // The two stranded reasons no row reached, so all four wordings are executed.
    // Two records each holding a project, which no sweep covered — and the state
    // where the deferral's pair check and its refusal branch disagreed, so the
    // refusal instructed an edit that made every later call fail.
    {
      name: 'a deployment offered for a committed project while the mapping holds another',
      setup: ({ repo: dir }) => {
        commit(dir, { projectUrl: 'https://forms.mysite.com/one' });
        seed(dir, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });
      },
      probe: set(() => ['--base-url', 'https://forms.mysite.com/one']),
    },
    {
      name: 'a write over a deployment recorded for a different project',
      setup: ({ repo: dir }) =>
        seed(dir, {
          FORMIO_PROJECT_URL: 'https://other.mysite.com',
          FORMIO_BASE_URL: 'https://forms.mysite.com',
        }),
      probe: set(() => ['--project-url', 'https://myproject.mysite.com']),
    },
    {
      name: 'a write over a deployment whose recorded project is unusable',
      setup: ({ repo: dir }) =>
        seed(dir, {
          FORMIO_PROJECT_URL: 'myproject.mysite.com',
          FORMIO_BASE_URL: 'https://forms.mysite.com',
        }),
      probe: set(() => ['--project-url', 'https://myproject.mysite.com']),
    },
  ];

  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    'makes progress after %s',
    (_name, scenario) => {
      const env = scenario.env ?? {};
      stateUrls = [];
      scenario.setup({ repo, cacheDir });
      stateUrls.push(
        ...Object.values(env).filter((value): value is string => Boolean(value?.includes('://')))
      );

      // The state of the directory, which is what "progress" is about.
      const resolves = () =>
        runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });
      const before = resolves();

      const { result: probed, argv } = scenario.probe({ repo, cacheDir, env });
      const output = `${probed.stdout}\n${probed.stderr}`;

      // A state that simply resolves has terminated, which is what this property is
      // about. Several rows exist because they USED to fail; the row stays so the
      // regression stays covered.
      if (probed.exitCode === 0) {
        expect(
          `${resolves().exitCode}`,
          `the call succeeded but the directory still does not resolve:\n${output}`
        ).toBe('0');
        return;
      }

      const commands = commandsIn(output);
      const edit = namedFileEdit(output);

      if (scenario.manualRepairFirst) {
        expect(
          saysManualRepairFirst(output),
          `a state needing a hand repair does not say so:\n${output}`
        ).toBe(true);
        for (const { tokens } of commands) {
          expect(
            runProjectCommand(tokens, { cacheDir, env }).exitCode,
            `says a hand repair comes first, but "${tokens.join(' ')}" ran:\n${output}`
          ).not.toBe(0);
        }
        return;
      }

      // 1. NON-LOOPING.
      for (const { tokens } of commands) {
        expect(tokens.join(' '), `names the very command that produced it:\n${output}`).not.toBe(
          argv.join(' ')
        );
      }

      // 3. HONESTY.
      if (commands.length === 0 && !edit) {
        expect(
          saysManualRepairFirst(output) || asksTheUserForAValue(output),
          `names no command, no edit, and no step a human can take:\n${output}`
        ).toBe(true);
        // And it points at a concrete value, rather than describing the situation.
        // A message whose interpolated value came out `undefined` reads as advice and
        // tells the caller nothing about which of their inputs to change.
        // A WHOLE value, never a scheme: matching on `value.split('://')[0]` meant any
        // message containing the substring "https" satisfied this — which every
        // message on this surface does, because they carry example URLs.
        const candidates = [...stateUrls, ...argv.filter((token) => token.includes('://'))];
        expect(
          candidates.some((value) => output.includes(value)),
          `names no value from this state, so nothing says what to change:\n${output}`
        ).toBe(true);
        expect(output, `interpolated an undefined value:\n${output}`).not.toMatch(/undefined/);
        return;
      }
      if (/\b(write|edit|command) below\b/i.test(output)) {
        expect(
          commands.length > 0 || Boolean(edit),
          `promises a remedy "below" and names none:\n${output}`
        ).toBe(true);
      }

      // 2. PROGRESS.
      // 2. PROGRESS — and the FIRST thing the message names must itself be accepted.
      // Tolerating a refused first step, so long as its own refusal named something
      // that worked, is what let two remedies ship that the server rejects outright:
      // the caller does what they were told, is refused, and only a second message
      // rescues them. That is the loop this property exists to forbid.
      if (edit) {
        const existing = fs.existsSync(edit.filePath)
          ? (JSON.parse(fs.readFileSync(edit.filePath, 'utf8')) as Record<string, unknown>)
          : {};
        // The value the message NAMES, where it names one — writing our own answer
        // instead hides a remedy that instructs a value the resolver refuses.
        fs.writeFileSync(
          edit.filePath,
          JSON.stringify({ ...existing, [edit.key]: edit.value ?? ANSWERS['<base_url>'] })
        );
        const afterEdit = resolves();
        expect(
          afterEdit.exitCode,
          `the edit this message instructs leaves the directory unusable:\n${output}\n\n${afterEdit.stderr}`
        ).not.toBe(2);
      } else {
        // EVERY command the message names with all its values known must be accepted,
        // not merely the first. Judged on `commands[0]` alone, a second remedy the
        // writer refuses rode along unchecked — and a message that names two calls is
        // exactly where one of them goes stale.
        for (const candidate of commands.slice(1).filter((command) => !command.hadPlaceholder)) {
          const result = runProjectCommand(candidate.tokens, { cacheDir, env });
          expect(
            result.exitCode,
            `also names a command with every value known, and refuses it:\n${output}\n\n${result.stderr}`
          ).toBe(0);
        }
        const [first] = commands;
        const applied = runProjectCommand(first.tokens, { cacheDir, env });
        if (!first.hadPlaceholder) {
          // Every value was already known to the server, so a refusal here is the
          // server naming a call it knows it will reject.
          expect(
            applied.exitCode,
            `names a command with every value already known, and refuses it:\n${output}\n\n${applied.stderr}`
          ).toBe(0);
        } else if (applied.exitCode !== 0) {
          // One further round is allowed, for a value the first message could not
          // have known — and only when the refusal is genuinely ABOUT that value.
          // Granting the tolerance on the mere presence of a placeholder made a
          // remedy that always needs a pointless second round indistinguishable from
          // one whose second round is the user's own answer.
          const supplied = first.tokens.filter((token) => Object.values(ANSWERS).includes(token));
          expect(
            supplied.some((value) => applied.stderr.includes(value)),
            `refused for a reason that has nothing to do with the value supplied:\n${output}\n\n${applied.stderr}`
          ).toBe(true);
          const [next] = commandsIn(applied.stderr);
          expect(
            next,
            `the named command was refused and its message names nothing further:\n${output}\n\n${applied.stderr}`
          ).toBeDefined();
          expect(
            next.tokens.join(' '),
            `the refusal names the command that just failed:\n${applied.stderr}`
          ).not.toBe(first.tokens.join(' '));
          expect(
            runProjectCommand(next.tokens, { cacheDir, env }).exitCode,
            `no command in the chain succeeds:\n${applied.stderr}`
          ).toBe(0);
        }
      }

      const after = resolves();
      expect(
        `${after.exitCode}|${after.stdout}`,
        `acting on the message left the directory resolving exactly as before:\n${output}`
      ).not.toBe(`${before.exitCode}|${before.stdout}`);

      // Progress is not merely "something changed". A remedy that re-points the
      // directory at a DIFFERENT project has not recorded what the caller asked for —
      // it has overwritten their configuration — and "resolves differently" counted
      // that as success. Only a call that itself names a project may change which
      // project resolves.
      // Both streams: a resolved answer prints on stdout, while the half-configured
      // one prints on stderr — reading stdout alone silently skipped this check for
      // every state that has a project but no deployment, which is most of them.
      const projectIn = (result: ProjectCommandResult) =>
        `${result.stdout}\n${result.stderr}`.match(/Project URL: (\S+)/)?.[1];
      const wasResolving = projectIn(before);
      if (wasResolving && !argv.includes('--project-url')) {
        expect(
          projectIn(after),
          `the remedy re-pointed the directory at another project:\n${output}`
        ).toBe(wasResolving);
      }
    }
  );
});

/**
 * The same property over the TOOL surface, which the table above cannot reach.
 *
 * Every row there drives `runProjectCommand`, whose fallback directory IS the user's
 * shell — so no CLI row can reach a state where the directory in the answer is one
 * the caller did not choose. That is exactly where `project_get` and `project_set`
 * disagreed: the report omits its remedy and says to call again with the user's cwd,
 * while the writer's refusals named the server's own spawn directory as the place to
 * record the pair, one sentence before warning never to record there.
 */
describe('a tool answer never sends the caller to a directory it warns against', () => {
  let serverCwd: string;

  beforeEach(() => {
    serverCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-toolterm-'));
    fs.mkdirSync(path.join(serverCwd, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => fs.rmSync(serverCwd, { recursive: true, force: true }));

  const callSet = async (args: Record<string, unknown>, envProject?: string) => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => serverCwd, projectUrl: () => envProject })
    );
    const result = (await client.callTool({
      name: 'project_set',
      arguments: args,
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    return { isError: result.isError, text: result.content.map((entry) => entry.text).join('\n') };
  };

  const callGet = async (args: Record<string, unknown>, config: Record<string, string> = {}) => {
    const client = await connectTools((server) =>
      registerProjectGetTool(server, config, { cwd: () => serverCwd })
    );
    const result = (await client.callTool({
      name: 'project_get',
      arguments: args,
    })) as unknown as {
      content: Array<{ text: string }>;
      structuredContent?: { remedy?: unknown };
    };
    return {
      text: result.content.map((entry) => entry.text).join('\n'),
      remedy: result.structuredContent?.remedy,
    };
  };

  /** An instruction to record something under a named directory. */
  const instructsRecordingUnder = (text: string, dir: string) =>
    new RegExp(
      `(?:call project_set again with|call project_set with)[^.]*cwd[^.]*${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i'
    ).test(text);

  it.each([
    [
      'a deployment offered while the environment holds the project',
      () => callSet({ baseUrl: 'https://api.mysite.com' }, 'https://myproject.mysite.com'),
    ],
    [
      'a deployment offered with nothing configured',
      () => callSet({ baseUrl: 'https://api.mysite.com' }),
    ],
  ])('%s', async (_name, call) => {
    const { isError, text } = await call();

    expect(isError).toBe(true);
    // Either it does not name this directory as the place to record, or it is not
    // warning against it — never both.
    if (/BEFORE recording anything/.test(text)) {
      expect(
        instructsRecordingUnder(text, serverCwd),
        `tells the caller to record under the very directory it warns against:\n${text}`
      ).toBe(false);
    }
  });

  it('omits the reader’s remedy for the same state, rather than naming that directory', async () => {
    const { text, remedy } = await callGet({}, { projectUrl: 'https://myproject.mysite.com' });

    expect(remedy).toBeUndefined();
    expect(text).toMatch(/BEFORE recording anything/);
  });
});
