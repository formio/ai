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

const { registerProjectExportTool } = await import('../tools/project_export.js');

describe('project_export tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient(registerProjectExportTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('project_export');
  });

  it('calls GET /export and returns the template JSON', async () => {
    const template = {
      title: 'My App',
      name: 'myApp',
      roles: {},
      forms: {},
      resources: {},
      actions: {},
    };
    mockFormioFetch.mockResolvedValue(template);
    const { client } = await createTestClient(registerProjectExportTool);

    const result = await client.callTool({ name: 'project_export', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith('export', {}, TEST_CONFIG);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(template, null, 2) }]);
  });

  it('returns error response on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 401'));
    const { client } = await createTestClient(registerProjectExportTool);

    const result = await client.callTool({ name: 'project_export', arguments: { cwd: TEST_CWD } });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('401') }),
    ]);
  });
});
