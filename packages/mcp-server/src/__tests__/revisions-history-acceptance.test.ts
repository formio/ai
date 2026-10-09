/**
 * Saving a form without revision history is an argument the caller passes, never a
 * prompt the server raises. The client here declares elicitation, so a server that
 * still asked out of band would reach its handler — and every case fails if it does.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { freshProjectUrl, stubRevisionsLicence, TEST_CONFIG, TEST_CWD } from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { writeProjectEntry } from '../project-map.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const mockOpenInBrowser = vi.fn();
vi.mock('../browser-launch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../browser-launch.js')>()),
  openInBrowser: (...args: unknown[]) => mockOpenInBrowser(...args),
}));

const { registerFormCreateTool } = await import('../tools/form_create.js');
const { registerFormUpdateTool } = await import('../tools/form_update.js');

const FORM_ID = '67890abcdef012345678abcd';
const NEW_FORM = { title: 'Contact', name: 'contact', path: 'contact', components: [] };

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  _meta?: Record<string, { code?: string } | undefined>;
}

type FetchOptions = { method?: string; body?: Record<string, unknown> } | undefined;

const elicitations: unknown[] = [];

function writes() {
  return mockFormioFetch.mock.calls.filter(([, , , options]) => (options as FetchOptions)?.method);
}

function writtenBody(): Record<string, unknown> | undefined {
  const [, , , options] = writes()[0] ?? [];
  return (options as FetchOptions)?.body;
}

function codeOf(result: ToolResult) {
  return result._meta?.[ERROR_META_KEY]?.code;
}

function textOf(result: ToolResult) {
  return result.content.map((part) => part.text ?? '').join('\n');
}

/** A client that supports elicitation, on a project whose deployment no test has probed. */
async function connect(projectUrl: string = freshProjectUrl()) {
  writeProjectEntry({ cwd: TEST_CWD, env: { FORMIO_PROJECT_URL: projectUrl } });
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerFormCreateTool(server, TEST_CONFIG);
  registerFormUpdateTool(server, TEST_CONFIG);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'eliciting-client', version: '0.0.0' },
    { capabilities: { elicitation: {} } }
  );
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    elicitations.push(request);
    return { action: 'decline' };
  });
  await client.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: { cwd: TEST_CWD, ...args } })) as ToolResult;
  return { call, projectUrl };
}

/** The stored form a standard update reads before it writes. */
function storedForm(revisions: string) {
  mockFormioFetch.mockImplementation((_path: string, _p: unknown, _c: unknown, o: FetchOptions) =>
    Promise.resolve(o?.method ? { _id: FORM_ID } : { _id: FORM_ID, name: 'contact', revisions })
  );
}

beforeEach(() => {
  mockFormioFetch.mockReset();
  mockFormioFetch.mockResolvedValue({ _id: FORM_ID });
  mockOpenInBrowser.mockReset();
  elicitations.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(elicitations, 'the server sent an elicitation request').toEqual([]);
  expect(mockOpenInBrowser, 'the server opened a local page').not.toHaveBeenCalled();
});

describe('acceptNoHistory is an argument of both form writes', () => {
  it.each(['form_create', 'form_update'])('%s declares acceptNoHistory', async (name) => {
    stubRevisionsLicence(true);
    writeProjectEntry({ cwd: TEST_CWD, env: { FORMIO_PROJECT_URL: freshProjectUrl() } });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerFormCreateTool(server, TEST_CONFIG);
    registerFormUpdateTool(server, TEST_CONFIG);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'c', version: '0.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const properties = (tools.find((tool) => tool.name === name)?.inputSchema.properties ??
      {}) as Record<string, { type?: string; description?: string }>;
    expect(properties.acceptNoHistory?.type).toBe('boolean');
    expect(properties.acceptNoHistory?.description).toBeTruthy();
  });
});

describe('on a deployment without the revisions licence', () => {
  beforeEach(() => {
    stubRevisionsLicence(false);
  });

  it('form_create refuses with HISTORY_NOT_ACCEPTED and sends no POST', async () => {
    const { call } = await connect();

    const result = await call('form_create', { form: NEW_FORM });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('HISTORY_NOT_ACCEPTED');
    expect(textOf(result)).toMatch(/^\[HISTORY_NOT_ACCEPTED\] /);
    expect(textOf(result)).toMatch(/ask the user/i);
    expect(textOf(result)).toContain('acceptNoHistory: true');
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('form_create with acceptNoHistory creates the form without a revisions setting', async () => {
    const { call } = await connect();

    const result = await call('form_create', {
      form: { ...NEW_FORM, revisions: 'original' },
      acceptNoHistory: true,
    });

    expect(result.isError).toBeFalsy();
    expect(writes()).toHaveLength(1);
    expect(writtenBody()).toEqual(NEW_FORM);
  });

  it('form_update refuses with HISTORY_NOT_ACCEPTED and sends no PUT', async () => {
    const { call } = await connect();

    const result = await call('form_update', { formId: FORM_ID, form: NEW_FORM, note: 'n' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('HISTORY_NOT_ACCEPTED');
    expect(writes()).toEqual([]);
  });

  it('form_update with acceptNoHistory saves without a revisions setting', async () => {
    const { call } = await connect();

    const result = await call('form_update', {
      formId: FORM_ID,
      form: { ...NEW_FORM, revisions: 'current' },
      note: 'n',
      acceptNoHistory: true,
    });

    expect(result.isError).toBeFalsy();
    expect(writtenBody()).toEqual({ ...NEW_FORM, _vnote: '@formio/mcp: n' });
  });
});

describe('a licensed form whose revisions are off', () => {
  beforeEach(() => {
    stubRevisionsLicence(true);
    storedForm('');
  });

  it('form_update refuses with HISTORY_NOT_ACCEPTED, naming both ways forward, and sends no PUT', async () => {
    const { call } = await connect();

    const result = await call('form_update', { formId: FORM_ID, form: NEW_FORM, note: 'n' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('HISTORY_NOT_ACCEPTED');
    expect(textOf(result)).toMatch(/ask the user/i);
    expect(textOf(result)).toContain('acceptNoHistory: true');
    expect(textOf(result)).toContain('"original"');
    expect(textOf(result)).toContain('"current"');
    expect(writes()).toEqual([]);
  });

  it('a retry with form.revisions "original" enables revisions and saves', async () => {
    const { call } = await connect();

    const result = await call('form_update', {
      formId: FORM_ID,
      form: { ...NEW_FORM, revisions: 'original' },
      note: 'n',
    });

    expect(result.isError).toBeFalsy();
    expect(writtenBody()).toEqual({ ...NEW_FORM, revisions: 'original', _vnote: '@formio/mcp: n' });
  });

  it('a retry with acceptNoHistory saves without enabling revisions', async () => {
    const { call } = await connect();

    const result = await call('form_update', {
      formId: FORM_ID,
      form: NEW_FORM,
      note: 'n',
      acceptNoHistory: true,
    });

    expect(result.isError).toBeFalsy();
    expect(writtenBody()).toEqual({ ...NEW_FORM, _vnote: '@formio/mcp: n' });
  });

  // Every call stands alone: an acceptance is not remembered for the next save.
  it('asks again on the next save after one was accepted', async () => {
    const { call } = await connect();

    await call('form_update', {
      formId: FORM_ID,
      form: NEW_FORM,
      note: 'n',
      acceptNoHistory: true,
    });
    const second = await call('form_update', { formId: FORM_ID, form: NEW_FORM, note: 'n' });

    expect(codeOf(second)).toBe('HISTORY_NOT_ACCEPTED');
    expect(writes()).toHaveLength(1);
  });
});

// Setting `revisions: ""` is the agent turning history off, so on a licensed
// deployment it needs the same acceptance as any other save without history —
// whatever the stored form says.
describe('explicitly disabling history on a licensed deployment', () => {
  beforeEach(() => {
    stubRevisionsLicence(true);
  });

  const disabled = { ...NEW_FORM, revisions: '' };
  const cases = [
    {
      label: 'form_create with revisions ""',
      stored: undefined,
      call: 'form_create',
      args: { form: disabled },
      expected: disabled,
    },
    {
      label: 'form_update with revisions "" on a form whose revisions are on',
      stored: 'original',
      call: 'form_update',
      args: { formId: FORM_ID, form: disabled, note: 'n' },
      expected: { ...disabled, _vnote: '@formio/mcp: n' },
    },
    {
      label: 'form_update with revisions "" on a form whose revisions are off',
      stored: '',
      call: 'form_update',
      args: { formId: FORM_ID, form: disabled, note: 'n' },
      expected: { ...disabled, _vnote: '@formio/mcp: n' },
    },
  ];

  it.each(cases)('$label refuses with HISTORY_NOT_ACCEPTED and writes nothing', async (c) => {
    if (c.stored !== undefined) storedForm(c.stored);
    const { call } = await connect();

    const result = await call(c.call, c.args);

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('HISTORY_NOT_ACCEPTED');
    expect(textOf(result)).toMatch(/ask the user/i);
    expect(textOf(result)).toContain('acceptNoHistory: true');
    expect(textOf(result)).toContain('"original"');
    expect(textOf(result)).toContain('"current"');
    expect(writes()).toEqual([]);
  });

  it.each(cases)('$label is saved as given with acceptNoHistory', async (c) => {
    if (c.stored !== undefined) storedForm(c.stored);
    const { call } = await connect();

    const result = await call(c.call, { ...c.args, acceptNoHistory: true });

    expect(result.isError).toBeFalsy();
    expect(writes()).toHaveLength(1);
    expect(writtenBody()).toEqual(c.expected);
  });
});

describe('the retired licence-consent file', () => {
  const consentFile = () => path.join(os.homedir(), '.formio', 'revisions-license-consent.json');

  beforeEach(() => {
    stubRevisionsLicence(false);
  });

  it('is not read: an approval recorded in it does not stand in for acceptNoHistory', async () => {
    const projectUrl = freshProjectUrl();
    const deployment = projectUrl.replace(/\/[^/]+$/, '');
    const { call } = await connect(projectUrl);
    const recorded = JSON.stringify({ [deployment]: true });
    fs.writeFileSync(consentFile(), recorded);

    const result = await call('form_create', { form: NEW_FORM });

    expect(codeOf(result)).toBe('HISTORY_NOT_ACCEPTED');
    expect(fs.readFileSync(consentFile(), 'utf-8')).toBe(recorded);
  });

  it('is not written when a save without history is accepted', async () => {
    const { call } = await connect();

    await call('form_create', { form: NEW_FORM, acceptNoHistory: true });

    expect(fs.existsSync(consentFile())).toBe(false);
  });
});
