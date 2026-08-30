import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runProjectCommand } from '../cli/project-command.js';
import { createServer } from '../server.js';
import { registerProjectGetTool } from '../tools/project_get.js';

/**
 * Two audiences, two texts.
 *
 * The project-URL guidance was written to stop an AGENT constructing a URL it should
 * have asked for, and a third of it is prohibitions that only make sense to something
 * that might otherwise build one: a `*.form.io` host is not a Base URL, `api.form.io/x`
 * is not a project, never append a project name to a deployment URL. Those belong where
 * the agent reads them.
 *
 * The unconfigured report goes somewhere else. Every skill instructs the agent to relay
 * it verbatim and ask for the one value it names, so it is read by the PERSON being
 * asked — who is going to paste the URL they already have, and for whom the prohibitions
 * are noise about guardrails built for somebody else. Shipped as one text it reached
 * that person as eight lines where three would do.
 *
 * So: the shapes go to both, and the prohibitions go only to the agent.
 */
const PROHIBITIONS = [
  /never a Base URL/i,
  /never build a Project URL by appending/i,
  /not a hosted project URL/i,
];

/** What the person being asked actually needs in order to answer. */
const SHAPES = [/examples\.form\.io/, /forms\.mysite\.com|forms\.yoursite\.com/, /sub-domain/i];

describe('guidance is written for the audience that reads it', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-audience-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-audience-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const unconfiguredReports = async () => {
    const cli = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectGetTool(server, {}, { cwd: () => repo });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    const tool = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as { content: Array<{ text: string }> };
    await client.close();

    // The error EVERY OTHER tool raises for the same state. It is relayed to the user
    // exactly as the report is, so the audience rule has to cover it — checking only
    // project_get left the full guidance free to sit in the message a caller actually
    // hits first when it skips the preflight.
    const bare = createServer();
    const [bareClient, bareServer] = InMemoryTransport.createLinkedPair();
    await bare.connect(bareServer);
    const unconfigured = new Client({ name: 'test-client', version: '0.0.0' });
    await unconfigured.connect(bareClient);
    const raised = (await unconfigured.callTool({
      name: 'form_list',
      arguments: { cwd: repo },
    })) as unknown as { content: Array<{ text: string }> };
    await unconfigured.close();

    return {
      'the CLI report': cli.stdout + cli.stderr,
      'the tool report': tool.content.map((entry) => entry.text).join('\n'),
      'the error a tool raises': raised.content.map((entry) => entry.text).join('\n'),
    };
  };

  it.each(PROHIBITIONS)('keeps %s out of the report a user is shown', async (prohibition) => {
    for (const [name, report] of Object.entries(await unconfiguredReports())) {
      expect(report, `${name} carries an agent-only prohibition`).not.toMatch(prohibition);
    }
  });

  it.each(SHAPES)('still tells the user %s', async (shape) => {
    for (const [name, report] of Object.entries(await unconfiguredReports())) {
      expect(report, `${name} dropped a shape the user needs to answer`).toMatch(shape);
    }
  });

  // The prohibitions are not deleted — they move. An agent that never reads a skill
  // gets them at connect time, which is the surface they were written for.
  it.each(PROHIBITIONS)('still tells the agent %s, in the server instructions', async (rule) => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    expect(client.getInstructions() ?? '').toMatch(rule);
    await client.close();
  });

  // A backstop against REGROWTH, not a target to trim toward.
  //
  // The three assertions above name the material that must stay out; this catches the
  // next paragraph nobody thought to name.
  //
  // EVERY surface is measured before anything is asserted, and the failure names all of
  // them. That is not tidiness — the previous version put the assertion inside the loop,
  // so it threw on the first entry and could only ever report the CLI surface, which is
  // how the ceiling came to be calibrated against the SHORTEST of the three. It was set
  // to 900 from a comment citing "the report is 837 characters", leaving eleven
  // characters of headroom on the longest and firing on any reworded sentence.
  //
  // Measured today: the CLI report 837, the tool report 880, the error a tool raises 889.
  // The guidance removed from these surfaces was 270 characters, so regrowth of that size
  // lands at 1159 or above. A ceiling of 1050 still fails on it and leaves 161 characters
  // for ordinary editing. Raising it past 1159 retires the check rather than relaxing it,
  // which is the decision the numbers are written down to make visible.
  //
  // Measured with the directory PATH removed. It appears three times and is as long as
  // the caller's directory happens to be, so counting it measured the fixture's own
  // scratch path rather than the prose this assertion is about.
  it('keeps the unconfigured report brief', async () => {
    const measured = Object.entries(await unconfiguredReports()).map(([name, report]) => {
      const prose = report.split(repo).join('<dir>');
      return { name, length: prose.length, prose };
    });

    const tally = measured.map(({ name, length }) => `${name} ${length}`).join(', ');
    const over = measured.filter(({ length }) => length >= 1050);

    expect(
      over.map(({ name, length }) => `${name} is ${length} characters`),
      `every surface: ${tally}\n\n${over.map(({ prose }) => prose).join('\n\n')}`
    ).toEqual([]);
  });
});
