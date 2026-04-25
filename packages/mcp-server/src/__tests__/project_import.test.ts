import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerProjectImportTool } = await import('../tools/project_import.js');

describe('project_import tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is registered with a description referencing the formio-resource-planner skill', async () => {
    const { client } = await createTestClient(registerProjectImportTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'project_import');
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/formio-resource-planner/);
  });

  it('wraps the template in { template: ... } and calls POST /import', async () => {
    const template = {
      title: 'My App',
      name: 'myApp',
      version: '2.0.0',
      roles: {},
      resources: {},
      forms: {},
      actions: {},
    };
    mockFormioFetch.mockResolvedValue('Ok');
    const { client } = await createTestClient(registerProjectImportTool);

    await client.callTool({ name: 'project_import', arguments: { cwd: TEST_CWD, template } });

    expect(mockFormioFetch).toHaveBeenCalledWith('import', {}, TEST_CONFIG, {
      method: 'POST',
      body: { template },
      responseType: 'text',
    });
  });

  it('returns "Ok" on successful import', async () => {
    mockFormioFetch.mockResolvedValue('Ok');
    const { client } = await createTestClient(registerProjectImportTool);

    const result = await client.callTool({
      name: 'project_import',
      arguments: {
        cwd: TEST_CWD,
        template: {
          title: 'App',
          name: 'app',
          version: '1.0.0',
          roles: {},
          resources: {},
          forms: {},
          actions: {},
        },
      },
    });

    expect(result.content).toEqual([{ type: 'text', text: 'Ok' }]);
  });

  it('returns error response on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 400'));
    const { client } = await createTestClient(registerProjectImportTool);

    const result = await client.callTool({
      name: 'project_import',
      arguments: {
        cwd: TEST_CWD,
        template: {
          title: 'Bad',
          name: 'bad',
          version: '1.0.0',
          roles: {},
          resources: {},
          forms: {},
          actions: {},
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });
});
