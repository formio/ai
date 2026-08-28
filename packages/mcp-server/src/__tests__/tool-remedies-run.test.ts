import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

/**
 * The same property the shell reader has, for the reader that calls tools.
 *
 * `printed-remedies-run.test.ts` executes what the CLI prints. Nothing executed what
 * the TOOL reports, so its remedies were asserted by reading their wording — which is
 * how a remedy that names one write for three different records went unnoticed until a
 * reviewer traced it by hand. An entry point that is described but never driven is
 * where these defects live.
 *
 * The report names its next call structurally, so this test does what an agent does:
 * take `remedy`, fill in the one argument under `supply`, call it, and require the next
 * report to resolve the pair that was supplied.
 */
interface Report {
  status: string;
  projectUrl?: string;
  baseUrl?: string;
  message: string;
  remedy?: { tool: string; arguments: Record<string, string>; supply: string[] };
}

describe('the remedy the tool reports is a call that resolves the directory', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-toolremedy-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  // What a user answers when the report asks. Distinct from anything a fixture holds,
  // so a value carried from an existing record cannot pass as the one supplied.
  const ANSWERS: Record<string, string> = {
    // The unconfigured remedy asks for a Project URL alone, so the answer here names its
    // own deployment. The shape that does not is a second round, asserted below.
    projectUrl: 'https://answered.form.io',
    baseUrl: 'https://api.answered.mysite.com',
  };

  const client = async (env: NodeJS.ProcessEnv) => {
    return connectTools((server) => {
      registerProjectSetTool(server, {
        cwd: () => repo,
        projectUrl: () => env.FORMIO_PROJECT_URL,
      });
      registerProjectGetTool(
        server,
        { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
        { cwd: () => repo }
      );
    });
  };

  const report = async (env: NodeJS.ProcessEnv): Promise<Report> => {
    const connected = await client(env);
    const result = (await connected.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as { structuredContent: Report };
    return result.structuredContent;
  };

  const applyRemedy = async (remedy: Report['remedy'], env: NodeJS.ProcessEnv) => {
    const connected = await client(env);
    const answered = Object.fromEntries(
      (remedy as NonNullable<Report['remedy']>).supply.map((name) => [name, ANSWERS[name]])
    );
    const result = (await connected.callTool({
      name: (remedy as NonNullable<Report['remedy']>).tool,
      arguments: { ...(remedy as NonNullable<Report['remedy']>).arguments, ...answered },
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    return result;
  };

  const resolvesAfterItsOwnRemedy = async (
    env: NodeJS.ProcessEnv,
    expected: { projectUrl: string; baseUrl: string }
  ) => {
    const first = await report(env);
    expect(first.status, `expected a report with a remedy:\n${first.message}`).not.toBe('ok');
    expect(first.remedy, `no remedy in:\n${first.message}`).toBeDefined();

    const applied = await applyRemedy(first.remedy, env);
    expect(
      applied.isError,
      `the remedy failed:\n${applied.content.map((entry) => entry.text).join('\n')}`
    ).toBeFalsy();

    const after = await report(env);
    expect(after.status, `still unresolved:\n${after.message}`).toBe('ok');
    expect(after.projectUrl).toBe(expected.projectUrl);
    expect(after.baseUrl).toBe(expected.baseUrl);
  };

  it('resolves a directory with nothing configured', async () => {
    await resolvesAfterItsOwnRemedy(
      {},
      { projectUrl: ANSWERS.projectUrl, baseUrl: 'https://api.form.io' }
    );
  });

  // The one answer that cannot complete that call on its own. The refusal has to say
  // which value it still needs, or the caller is left holding an error instead of a
  // configured directory — and the user is still asked for one value at a time.
  it('completes when the answered project names no deployment', async () => {
    const first = await report({});
    const connected = await client({});

    const refused = (await connected.callTool({
      name: 'project_set',
      arguments: {
        ...(first.remedy as NonNullable<Report['remedy']>).arguments,
        projectUrl: 'https://answered.mysite.com',
      },
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };

    expect(refused.isError).toBe(true);
    expect(refused.content.map((entry) => entry.text).join('\n')).toMatch(/baseUrl is required/);

    const completed = (await connected.callTool({
      name: 'project_set',
      arguments: {
        ...(first.remedy as NonNullable<Report['remedy']>).arguments,
        projectUrl: 'https://answered.mysite.com',
        baseUrl: ANSWERS.baseUrl,
      },
    })) as unknown as { isError?: boolean };

    expect(completed.isError).toBeFalsy();
    expect((await report({})).status).toBe('ok');
  });

  it('resolves a project the mapping holds', async () => {
    const dir = path.join(os.homedir(), '.formio');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_PROJECT_URL: 'https://mapped.mysite.com' } } })
    );

    await resolvesAfterItsOwnRemedy(
      {},
      { projectUrl: 'https://mapped.mysite.com', baseUrl: ANSWERS.baseUrl }
    );
  });

  // A committed project has no call remedy — the fix is an edit to the file this
  // server never writes — so the structured remedy is absent, the message names the
  // exact file and key, and performing that edit is what resolves the directory.
  it('resolves a project a committed formio.json holds, after the edit its message names', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com' })
    );

    const first = await report({});
    expect(first.status).toBe('base-url-unresolved');
    expect(first.remedy).toBeUndefined();
    expect(first.message).toContain(path.join(repo, 'formio.json'));
    expect(first.message).toMatch(/"baseUrl"/);

    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com', baseUrl: ANSWERS.baseUrl })
    );

    const after = await report({});
    expect(after.status, after.message).toBe('ok');
    expect(after.projectUrl).toBe('https://committed.mysite.com');
    expect(after.baseUrl).toBe(ANSWERS.baseUrl);
  });

  it('resolves a project only the environment holds', async () => {
    await resolvesAfterItsOwnRemedy(
      { FORMIO_PROJECT_URL: 'https://env.mysite.com' },
      { projectUrl: 'https://env.mysite.com', baseUrl: ANSWERS.baseUrl }
    );
  });

  // The remedy must reach the record that holds the project, not merely be a call that
  // succeeds: a committed project answered by a mapping write would report success and
  // leave the directory exactly as unresolved as before. There is no call that edits a
  // committed file, so no call remedy may be offered for one.
  it('offers no call remedy for a record project_set cannot write', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.mysite.com' })
    );

    const first = await report({});

    expect(first.remedy).toBeUndefined();
  });

  it('asks the user for exactly one value', async () => {
    const first = await report({ FORMIO_PROJECT_URL: 'https://env.mysite.com' });

    expect(first.status).toBe('base-url-unresolved');
    expect(first.remedy?.supply).toEqual(['baseUrl']);
  });
});
