import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerFormListTool } = await import('../tools/form_list.js');

describe('form_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_list');
  });

  it('sends default select and limit when called with no arguments', async () => {
    const forms = [{ _id: '1', title: 'Test Form' }];
    mockFormioFetch.mockResolvedValue(forms);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({
        select: '_id,title,name,path,type,tags',
        limit: '20',
      }),
      TEST_CONFIG
    );
  });

  it('returns JSON array as MCP text content', async () => {
    const forms = [{ _id: '1', title: 'Test Form' }];
    mockFormioFetch.mockResolvedValue(forms);
    const { client } = await createTestClient(registerFormListTool);

    const result = await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(forms, null, 2) }]);
  });

  it('passes type parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD, type: 'resource' } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ type: 'resource' }),
      TEST_CONFIG
    );
  });

  it('passes custom limit', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD, limit: 5 } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ limit: '5' }),
      TEST_CONFIG
    );
  });

  it('passes skip and limit for pagination', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD, skip: 20, limit: 10 } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ skip: '20', limit: '10' }),
      TEST_CONFIG
    );
  });

  it('passes sort parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD, sort: '-created' } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ sort: '-created' }),
      TEST_CONFIG
    );
  });

  it('overrides default select when provided', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, select: '_id,title,components' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ select: '_id,title,components' }),
      TEST_CONFIG
    );
  });

  it('joins tags array into comma-separated string', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, tags: ['survey', 'public'] },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ tags: 'survey,public' }),
      TEST_CONFIG
    );
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 401 Unauthorized'));
    const { client } = await createTestClient(registerFormListTool);

    const result = await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('401') }),
    ]);
  });
});
