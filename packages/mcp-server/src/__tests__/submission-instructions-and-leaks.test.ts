import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTestClient, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return { ...original, formioFetch: (...args: unknown[]) => mockFormioFetch(...args) };
});

const { SERVER_INSTRUCTIONS } = await import('../server.js');
const { registerAllTools } = await import('../tools/index.js');
const { getOrCreateKey } = await import('../submission-keys.js');

// A client with no skills installed learns the submission rule from the server alone.
describe('the server instructions state the submission scope', () => {
  it('names the created-and-signed scope, the no-other-route rule, and the action_list check', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/submission_\*/);
    expect(SERVER_INSTRUCTIONS).toMatch(/created and signed/);
    expect(SERVER_INSTRUCTIONS).toMatch(/no other submission|any other submission/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/action_list/);
  });
});

// The signing key is the whole boundary; it must never reach a tool result.
describe('no submission tool result carries the key or the key store', () => {
  const FORM_ID = '65f000000000000000000001';
  const SUB_ID = '65f0000000000000000000b1';
  const STORE = 'mcp-submission-keys.json';

  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  const CALLS: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: 'submission_create', args: { formIdOrPath: FORM_ID, data: { a: 1 }, purpose: 'test' } },
    { name: 'submission_get', args: { formIdOrPath: FORM_ID, submissionId: SUB_ID } },
    { name: 'submission_list', args: { formIdOrPath: FORM_ID } },
    {
      name: 'submission_update',
      args: { formIdOrPath: FORM_ID, submissionId: SUB_ID, data: { a: 2 } },
    },
    { name: 'submission_delete', args: { formIdOrPath: FORM_ID, submissionId: SUB_ID } },
  ];

  it.each(CALLS)('$name, on success and on failure', async ({ name, args }) => {
    const { client } = await createTestClient((server, config) => registerAllTools(server, config));
    const key = getOrCreateKey({ cwd: TEST_CWD });
    const secrets = [
      key.toString('hex'),
      key.toString('base64'),
      STORE,
      path.join(os.homedir(), '.formio'),
    ];

    mockFormioFetch.mockResolvedValue([]);
    const ok = JSON.stringify(
      await client.callTool({ name, arguments: { cwd: TEST_CWD, ...args } })
    );
    mockFormioFetch.mockRejectedValue(new Error('boom'));
    const failed = JSON.stringify(
      await client.callTool({ name, arguments: { cwd: TEST_CWD, ...args } })
    );

    for (const secret of secrets) {
      expect(ok).not.toContain(secret);
      expect(failed).not.toContain(secret);
    }
  });

  it('an unreadable key store yields an error naming neither the store nor its path', async () => {
    const { client } = await createTestClient((server, config) => registerAllTools(server, config));
    const dir = path.join(os.homedir(), '.formio');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, STORE), '{broken');
    mockFormioFetch.mockResolvedValue([]);

    const result = await client.callTool({
      name: 'submission_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(STORE);
    expect(JSON.stringify(result)).not.toContain(dir);
  });
});
