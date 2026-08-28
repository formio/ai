import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';

/**
 * One property, over the whole matrix and BOTH entry points: what a write REPORTS is
 * what the next read RESOLVES, by value.
 *
 * A shadowed write is legitimate — a mapping written under a committed file is the
 * fallback if that file goes away — so the write may report a pair that is not the one
 * it was passed; what it may not do is report one the next read contradicts, or claim
 * success over a directory that read cannot serve. Stated as a disjunction, the escape
 * hatch covered the comparison AND the assertion, and every case where a committed file
 * governed checked nothing about the reported pair at all.
 *
 * Driven through the CLI AND the tools, because they are two entry points with their
 * own messages and their own argument handling: a property asserted over one of them
 * says nothing about the other, and the half that went undriven is where a writer
 * reporting success over a record no reader could resolve survived.
 */
interface Written {
  ok: boolean;
  output: string;
  projectUrl?: string;
  baseUrl?: string;
}

interface Read {
  ok: boolean;
  projectUrl?: string;
  baseUrl?: string;
  output: string;
}

interface WriteArgs {
  cwd: string;
  projectUrl?: string;
  baseUrl?: string;
}

interface Driver {
  name: string;
  /** Where this entry point keeps ~/.formio, so a case can seed a mapping for it. */
  cacheDir: () => string;
  write: (args: WriteArgs, env: NodeJS.ProcessEnv) => Promise<Written>;
  read: (env: NodeJS.ProcessEnv) => Promise<Read>;
}

// The reader spells "no deployment" as a sentence rather than by omitting the line, so
// a bare \S+ capture read the first word of that sentence back as a URL.
const NOT_DETERMINED = 'could not be determined.';
const pairIn = (output: string) => {
  const baseUrl = output.match(/Base URL:\s+(.+)/)?.[1]?.trim();
  return {
    projectUrl: output.match(/Project URL: (\S+)/)?.[1],
    baseUrl: baseUrl === NOT_DETERMINED ? undefined : baseUrl,
  };
};

describe('a write reports what the next read resolves', () => {
  let cliCache: string;
  let repo: string;

  beforeEach(() => {
    cliCache = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-agree-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-agree-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    // The tools key on the real cache directory, which setup.ts points at a per-worker
    // temporary HOME. Cleared so cases cannot leak into each other.
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(cliCache, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  function commit(config: Record<string, string>) {
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(config));
  }

  function seed(cacheDir: string, env: Record<string, string>) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  }

  const toolClient = async (env: NodeJS.ProcessEnv) => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, {
      cwd: () => repo,
      projectUrl: () => env.FORMIO_PROJECT_URL,
      baseUrl: () => env.FORMIO_BASE_URL,
    });
    registerProjectGetTool(
      server,
      { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
      { cwd: () => repo }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  };

  const DRIVERS: Driver[] = [
    {
      name: 'the CLI',
      cacheDir: () => cliCache,
      write: async ({ cwd, projectUrl, baseUrl }, env) => {
        const result = runProjectCommand(
          [
            'project',
            'set',
            ...(projectUrl ? ['--project-url', projectUrl] : []),
            ...(baseUrl ? ['--base-url', baseUrl] : []),
            '--cwd',
            cwd,
          ],
          { cacheDir: cliCache, env }
        );
        return {
          ok: result.exitCode === 0,
          output: result.stdout + result.stderr,
          ...pairIn(result.stdout + result.stderr),
        };
      },
      read: async (env) => {
        const result = runProjectCommand(['project', 'get', '--cwd', repo], {
          cacheDir: cliCache,
          env,
        });
        return {
          ok: result.exitCode === 0,
          output: result.stdout + result.stderr,
          ...pairIn(result.stdout + result.stderr),
        };
      },
    },
    {
      name: 'the tools',
      cacheDir: () => path.join(os.homedir(), '.formio'),
      write: async ({ cwd, projectUrl, baseUrl }, env) => {
        const client = await toolClient(env);
        const result = (await client.callTool({
          name: 'project_set',
          arguments: {
            cwd,
            ...(projectUrl && { projectUrl }),
            ...(baseUrl && { baseUrl }),
          },
        })) as unknown as {
          isError?: boolean;
          content: Array<{ text: string }>;
          structuredContent?: { ok?: boolean; projectUrl?: string; baseUrl?: string };
        };
        return {
          // The writer's own success channel is its `ok` field, not isError: a write
          // that lands on disk and still leaves the directory unserviceable has a
          // resolved pair and a `changed` flag worth carrying, which isError discards.
          ok: !result.isError && result.structuredContent?.ok !== false,
          output: result.content.map((entry) => entry.text).join('\n'),
          projectUrl: result.structuredContent?.projectUrl,
          baseUrl: result.structuredContent?.baseUrl,
        };
      },
      read: async (env) => {
        const client = await toolClient(env);
        const result = (await client.callTool({
          name: 'project_get',
          arguments: { cwd: repo },
        })) as unknown as {
          isError?: boolean;
          content: Array<{ text: string }>;
          structuredContent?: { status: string; projectUrl?: string; baseUrl?: string };
        };
        return {
          ok: !result.isError && result.structuredContent?.status === 'ok',
          output: result.content.map((entry) => entry.text).join('\n'),
          projectUrl: result.structuredContent?.projectUrl,
          baseUrl: result.structuredContent?.baseUrl,
        };
      },
    },
  ];

  // Tied to non-effect, not to any mention of shadowing: a message that merely used the
  // word "outranks" in passing satisfied the disjunction without telling the caller that
  // what they just wrote is not what resolves.
  const saysItDoesNotTakeEffect = (output: string) =>
    /does not take effect|is the active project|stays the active project/i.test(output);

  // A write's pair is compared to the read's BY VALUE, with no disjunction: the escape
  // hatch used to cover the assertion as well as the comparison, so for every case where
  // a committed file governed, nothing about the reported pair was checked at all and a
  // writer that dropped the deployment from every such report passed all nine.

  interface Case {
    name: string;
    setup: (cacheDir: string) => void;
    args: Omit<WriteArgs, 'cwd'>;
    env?: NodeJS.ProcessEnv;
  }

  const CASES: Case[] = [
    { name: 'a fresh directory', setup: () => {}, args: { projectUrl: 'https://fresh.form.io' } },
    {
      name: 'a project whose deployment is supplied',
      setup: () => {},
      args: { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' },
    },
    {
      name: 're-pointing a mapped directory',
      setup: (cacheDir) =>
        seed(cacheDir, {
          FORMIO_PROJECT_URL: 'https://old.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        }),
      args: { projectUrl: 'https://new.form.io' },
    },
    {
      name: 'updating a mapped deployment',
      setup: (cacheDir) =>
        seed(cacheDir, {
          FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
          FORMIO_BASE_URL: 'https://old-api.mysite.com',
        }),
      args: { baseUrl: 'https://api.mysite.com' },
    },
    {
      name: 'a mapping under a committed file naming another project',
      setup: () => commit({ projectUrl: 'https://committed.form.io' }),
      args: { projectUrl: 'https://mapped.form.io' },
    },
    {
      name: 'a deployment under a committed file naming the same project',
      setup: (cacheDir) => {
        commit({ projectUrl: 'https://same.mysite.com' });
        seed(cacheDir, {
          FORMIO_PROJECT_URL: 'https://same.mysite.com',
          FORMIO_BASE_URL: 'https://old-api.mysite.com',
        });
      },
      args: { baseUrl: 'https://api.mysite.com' },
    },
    {
      name: 'a deployment under a committed file that already holds one',
      setup: (cacheDir) => {
        commit({
          projectUrl: 'https://same.mysite.com',
          baseUrl: 'https://committed-api.mysite.com',
        });
        seed(cacheDir, {
          FORMIO_PROJECT_URL: 'https://same.mysite.com',
          FORMIO_BASE_URL: 'https://old-api.mysite.com',
        });
      },
      args: { baseUrl: 'https://api.mysite.com' },
    },
    {
      name: 'a mapping written while the environment names another project',
      setup: () => {},
      args: { projectUrl: 'https://mapped.form.io' },
      env: { FORMIO_PROJECT_URL: 'https://env.form.io' },
    },
    {
      name: 'a directory holding a deployment with no project',
      setup: (cacheDir) => seed(cacheDir, { FORMIO_BASE_URL: 'https://stranded.mysite.com' }),
      args: { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' },
    },
  ];

  for (const driver of DRIVERS) {
    describe(`through ${driver.name}`, () => {
      it.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
        'agrees after %s',
        async (_name, testCase) => {
          testCase.setup(driver.cacheDir());
          const env = testCase.env ?? {};

          const written = await driver.write({ cwd: repo, ...testCase.args }, env);
          const read = await driver.read(env);

          // The pair is compared UNCONDITIONALLY, and this is the point of the file.
          // Guarding it behind `read.ok` sent exactly one of the nine cases — a
          // committed formio.json that supplies no deployment, the case the header
          // above is about — down a branch that asserted nothing about what was
          // reported, so a writer printing the deployment it had just been handed,
          // over a directory the next read says has none, passed the whole suite.
          // Both entry points carry a pair even when the answer is "not serviceable":
          // the tool in `structuredContent`, the CLI in its printed block.
          expect(
            { projectUrl: written.projectUrl, baseUrl: written.baseUrl },
            `the write reported ${written.projectUrl} on ${written.baseUrl} but the directory resolves ${read.projectUrl} on ${read.baseUrl}:\n${written.output}`
          ).toEqual({ projectUrl: read.projectUrl, baseUrl: read.baseUrl });

          // A write cannot report success over a directory the next read cannot serve.
          // The record may well belong on disk — a mapping under a committed file is
          // the fallback if that file goes away — but the caller acts on this result,
          // and "set" over a directory that still resolves no deployment sends them to
          // an authenticated call that fails for a reason this result already knew.
          if (!read.ok) {
            expect(
              written.ok,
              `the write reported success but the next read cannot serve this directory:\n${read.output}`
            ).toBe(false);
            return;
          }

          // And where the write does not take effect, it says so rather than leaving
          // the caller to infer it from a pair that is not what they passed.
          if (written.baseUrl !== testCase.args.baseUrl && testCase.args.baseUrl) {
            expect(
              saysItDoesNotTakeEffect(written.output),
              `the write did not record what was passed and did not say why:\n${written.output}`
            ).toBe(true);
          }
        }
      );
    });
  }

  // The two halves must also agree about WHICH RECORD holds the project, not only about
  // the pair that resolves. They did not: a mapping entry that is present but holds an
  // unusable URL is fatal to the reader — configuration that exists and cannot be
  // honoured — while the writer read it through a path that swallows entry validation,
  // concluded the mapping had no project, and deferred to the environment. So the reader
  // said "this directory's own record is broken, replace it" and the writer said "your
  // project comes from the environment, record the pair here" about one state. Following
  // the writer re-points the directory at the environment's project and overwrites the
  // broken entry, and the URL the user actually intended — recoverable from that entry,
  // and never shown to them — is gone.
  describe('a mapping entry that is present but unusable', () => {
    const BROKEN = 'htps://intended.mysite.com';
    const FROM_ENVIRONMENT = 'https://from-the-launch-manifest.mysite.com';

    it('is not diagnosed by the writer as the environment holding the project', async () => {
      seed(path.join(os.homedir(), '.formio'), {
        FORMIO_PROJECT_URL: BROKEN,
        FORMIO_BASE_URL: 'https://api.mysite.com',
      });
      const client = await toolClient({ FORMIO_PROJECT_URL: FROM_ENVIRONMENT });

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd: repo, baseUrl: 'https://deployment.mysite.com' },
      })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
      const output = result.content.map((entry) => entry.text).join('\n');

      expect(result.isError, `reported success:\n${output}`).toBe(true);
      expect(output, 'blamed the environment for a project this directory records').not.toContain(
        FROM_ENVIRONMENT
      );
      expect(output, 'did not name the unusable value, which is the only copy of it').toContain(
        BROKEN
      );
    });

    // A FORMIO_* name means the ENVIRONMENT VARIABLE and nothing else, which is a rule
    // this repository enforces over its skill prose and had no equivalent for the
    // server's own messages. The value here lives in the mapping file, so naming the
    // variable sends the caller hunting for something that need not exist while the bad
    // value sits on disk — and "Ignoring" is false besides: it is the reason for the
    // refusal, not something being passed over.
    it('names where the value lives, not an environment variable', () => {
      seed(cliCache, { FORMIO_PROJECT_URL: BROKEN });

      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
        { cacheDir: cliCache, env: {} }
      );

      expect(result.stderr).toContain(BROKEN);
      expect(result.stderr, 'named an environment variable for a value in the map').not.toContain(
        'FORMIO_PROJECT_URL'
      );
      expect(result.stderr).toContain(repo);
    });

    // ...but a broken mapping entry does NOT govern a directory a committed file
    // governs. The committed file outranks the mapping, so the remedy there is the edit
    // to that file, and announcing the mapping as "the record that governs this
    // directory" is the same wrong-record diagnosis one layer up — introduced by the
    // fix for it.
    it('does not claim to govern a directory a committed file governs', () => {
      commit({ projectUrl: 'https://committed.mysite.com' });
      seed(cliCache, { FORMIO_PROJECT_URL: BROKEN });

      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
        { cacheDir: cliCache, env: {} }
      );
      const output = result.stdout + result.stderr;

      expect(result.exitCode).not.toBe(0);
      expect(output, 'named the mapping as the governing record').toContain('formio.json');
      expect(output).toContain('https://committed.mysite.com');
      expect(output, 'blamed the mapping for a directory the committed file governs').not.toMatch(
        /mapping for .* holds an unusable value/
      );
    });

    it('does not claim to govern a committed directory, through the tools either', async () => {
      commit({ projectUrl: 'https://committed.mysite.com' });
      seed(path.join(os.homedir(), '.formio'), { FORMIO_PROJECT_URL: BROKEN });
      const client = await toolClient({});

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd: repo, baseUrl: 'https://api.mysite.com' },
      })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
      const output = result.content.map((entry) => entry.text).join('\n');

      expect(result.isError).toBe(true);
      expect(output).toContain('https://committed.mysite.com');
      expect(output, 'blamed the mapping for a directory the committed file governs').not.toMatch(
        /mapping for .* holds an unusable value/
      );
    });

    // The other shape of the same state: the entry is not an object with an env of
    // strings at all. Caught in a different place from an unusable URL, and it has to
    // reach the same answer — the record is present, so nothing else supplies the
    // project.
    it('is not diagnosed as the environment when the entry is structurally broken', () => {
      fs.mkdirSync(cliCache, { recursive: true });
      fs.writeFileSync(
        path.join(cliCache, 'projects.json'),
        JSON.stringify({ [repo]: 'a string' })
      );

      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://deployment.mysite.com', '--cwd', repo],
        { cacheDir: cliCache, env: { FORMIO_PROJECT_URL: FROM_ENVIRONMENT } }
      );
      const output = result.stdout + result.stderr;

      expect(result.exitCode, `reported success:\n${output}`).not.toBe(0);
      expect(output, 'blamed the environment for a directory its own record governs').not.toContain(
        FROM_ENVIRONMENT
      );
    });

    it('is not diagnosed by the CLI as the environment holding the project', () => {
      seed(cliCache, { FORMIO_PROJECT_URL: BROKEN, FORMIO_BASE_URL: 'https://api.mysite.com' });

      const result = runProjectCommand(
        ['project', 'set', '--base-url', 'https://deployment.mysite.com', '--cwd', repo],
        { cacheDir: cliCache, env: { FORMIO_PROJECT_URL: FROM_ENVIRONMENT } }
      );
      const output = result.stdout + result.stderr;

      expect(result.exitCode, `reported success:\n${output}`).not.toBe(0);
      expect(output).not.toContain(FROM_ENVIRONMENT);
      expect(output).toContain(BROKEN);
    });
  });

  // When a write cannot leave the directory serviceable it appends the READER's report,
  // so that report has to be the one the reader would actually give. The writer built it
  // from a narrower config than project_get passes — the environment's project but not
  // its base URL — so the two could describe the same directory differently in the
  // shadowed and unpaired lines, which is the invariant this whole file exists for.
  it('appends the same report the reader would give', async () => {
    commit({ projectUrl: 'https://same.mysite.com' });
    seed(path.join(os.homedir(), '.formio'), { FORMIO_PROJECT_URL: 'https://same.mysite.com' });
    const env = { FORMIO_BASE_URL: 'https://stranded.mysite.com' };
    const client = await toolClient(env);

    const written = (await client.callTool({
      name: 'project_set',
      arguments: { cwd: repo, baseUrl: 'https://api.mysite.com' },
    })) as unknown as { structuredContent?: { ok?: boolean; message?: string } };
    const read = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as { structuredContent?: { message?: string } };

    expect(written.structuredContent?.ok).toBe(false);
    expect(
      written.structuredContent?.message,
      'the write appended a report the reader does not give'
    ).toContain(read.structuredContent?.message as string);
  });

  // A committed file is checked for SHAPE where it is read and for VALIDITY only where
  // it wins precedence, so a file holding a URL the pair rule refuses parses cleanly and
  // fails later, inside the resolver. A writer that asks the resolver what is active and
  // swallows that failure reports a pair the file contradicts, and drops the one fact
  // the caller has to act on — the edit to the file that governs their directory.
  describe('a committed file the resolver refuses', () => {
    beforeEach(() => {
      commit({ projectUrl: 'https://api.form.io' });
    });

    it('is not reported as a successful write by the tools', async () => {
      const client = await toolClient({});

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd: repo, projectUrl: 'https://examples.form.io' },
      })) as unknown as {
        isError?: boolean;
        content: Array<{ text: string }>;
        structuredContent?: { projectUrl?: string; baseUrl?: string };
      };
      const output = result.content.map((entry) => entry.text).join('\n');

      expect(result.isError, `reported success:\n${output}`).toBe(true);
      expect(output, 'did not name the file that has to change').toContain('formio.json');
      expect(output, 'did not name the value the pair rule refuses').toContain(
        'https://api.form.io'
      );
    });

    it('is not reported as a successful write by the CLI', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', repo],
        { cacheDir: cliCache, env: {} }
      );

      expect(result.exitCode, `reported success:\n${result.stdout}`).not.toBe(0);
      expect(result.stdout + result.stderr).toContain('formio.json');
    });
  });

  // One directory, one record. The mapping is keyed by the caller's string, and a cwd
  // that sometimes carries a trailing slash is the same folder either way — keyed raw,
  // it became two independent mappings, so a write through one spelling left the other
  // reporting "nothing is configured" for the directory it had just configured. The
  // committed layer was always immune, because the walk resolves its path.
  describe('a cwd spelled with a trailing slash', () => {
    it('is the same record as the same directory without one', () => {
      const written = runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', `${repo}/`],
        { cacheDir: cliCache, env: {} }
      );
      expect(written.exitCode, written.stderr).toBe(0);

      const plain = runProjectCommand(['project', 'get', '--cwd', repo], {
        cacheDir: cliCache,
        env: {},
      });

      expect(plain.exitCode, `the directory it just configured reports:\n${plain.stderr}`).toBe(0);
      expect(plain.stdout).toContain('https://examples.form.io');
    });

    // A key an earlier release wrote raw. Normalizing only new keys silently strands
    // every mapping already on disk whose cwd carried a slash: the directory visibly has
    // an entry and reports "no project configured", and the next write leaves a dead
    // twin beside a live one.
    it('still finds a key an earlier release wrote unnormalized', () => {
      fs.mkdirSync(cliCache, { recursive: true });
      fs.writeFileSync(
        path.join(cliCache, 'projects.json'),
        JSON.stringify({ [`${repo}/`]: { env: { FORMIO_PROJECT_URL: 'https://legacy.form.io' } } })
      );

      const result = runProjectCommand(['project', 'get', '--cwd', repo], {
        cacheDir: cliCache,
        env: {},
      });

      expect(result.exitCode, `the legacy mapping was lost:\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('https://legacy.form.io');
    });

    it('leaves no dead twin behind after a write', () => {
      fs.mkdirSync(cliCache, { recursive: true });
      fs.writeFileSync(
        path.join(cliCache, 'projects.json'),
        JSON.stringify({ [`${repo}/`]: { env: { FORMIO_PROJECT_URL: 'https://legacy.form.io' } } })
      );

      runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', repo],
        { cacheDir: cliCache, env: {} }
      );
      const map = JSON.parse(fs.readFileSync(path.join(cliCache, 'projects.json'), 'utf8'));

      expect(Object.keys(map)).toEqual([repo]);
    });

    it('writes one entry, not two', () => {
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', repo],
        { cacheDir: cliCache, env: {} }
      );
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', `${repo}/`],
        { cacheDir: cliCache, env: {} }
      );

      const map = JSON.parse(fs.readFileSync(path.join(cliCache, 'projects.json'), 'utf8'));

      expect(Object.keys(map)).toHaveLength(1);
    });
  });

  // The write side has to reject what the read side cannot key on, or it records a pair
  // under a key no reader will ever look up — and reports success for it.
  describe('a directory a reader could never resolve', () => {
    it.each([
      ['a relative path', 'src'],
      ['an empty string', ''],
      ['a bare dot', '.'],
    ])('is refused by the tools: %s', async (_label, cwd) => {
      const client = await toolClient({});

      const result = (await client.callTool({
        name: 'project_set',
        arguments: { cwd, projectUrl: 'https://examples.form.io' },
      })) as unknown as { isError?: boolean; content: Array<{ text: string }> };

      expect(
        result.isError,
        `accepted ${JSON.stringify(cwd)}:\n${result.content.map((entry) => entry.text).join('\n')}`
      ).toBe(true);
    });

    it.each([
      ['a relative path', 'src'],
      ['a bare dot', '.'],
    ])('is refused by the CLI: %s', (_label, cwd) => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://examples.form.io', '--cwd', cwd],
        { cacheDir: cliCache, env: {} }
      );

      expect(result.exitCode, `accepted ${JSON.stringify(cwd)}`).not.toBe(0);
    });
  });
});
