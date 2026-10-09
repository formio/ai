import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectTools, createTestClient, TEST_CWD, TEST_PROJECT_URL } from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';

vi.mock('../ensure-auth.js', () => ({
  ensureAuthenticated: vi.fn(),
  resetAuthState: vi.fn(),
  invalidateJwtCache: vi.fn(),
}));

// The license gate is a pass-through here: these cases are about how a failed
// request is reported, not about revisions.
vi.mock('../revisions/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../revisions/index.js')>()),
  gateRevisionsLicense: vi
    .fn()
    .mockImplementation(async ({ form }: { form: Record<string, unknown> }) => ({
      licensed: true,
      form,
    })),
}));

const { registerFormCreateTool } = await import('../tools/form_create.js');
const { registerRoleListTool } = await import('../tools/role_list.js');

const FORM = { title: 'Contact', name: 'contact', path: 'contact', components: [] };

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  _meta?: Record<string, { code?: string; status?: number; body?: string } | undefined>;
}

function errorOf(result: ToolResult) {
  return result._meta?.[ERROR_META_KEY];
}

function textOf(result: ToolResult): string {
  return result.content.map((part) => part.text ?? '').join('\n');
}

describe('tool errors carry a structured code', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a Form.io 400 on form_create as VALIDATION_FAILED with the body', async () => {
    const body = JSON.stringify({
      status: 400,
      message: 'form validation failed: path: The Path must be unique per Project.',
      errors: {
        path: {
          path: 'path',
          name: 'ValidatorError',
          message: 'The Path must be unique per Project.',
        },
      },
    });
    mockFetch.mockResolvedValue(new Response(body, { status: 400 }));
    const { client } = await createTestClient(registerFormCreateTool);

    const result = (await client.callTool({
      name: 'form_create',
      arguments: { cwd: TEST_CWD, form: FORM },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(errorOf(result)).toEqual({ code: 'VALIDATION_FAILED', status: 400, body });
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result).startsWith('[VALIDATION_FAILED] ')).toBe(true);
    expect(textOf(result)).toContain('The Path must be unique per Project.');
  });

  it('reports a refused connection as NETWORK_ERROR naming the cause and URL', async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), {
      code: 'ECONNREFUSED',
    });
    mockFetch.mockRejectedValue(new TypeError('fetch failed', { cause }));
    const { client } = await createTestClient(registerFormCreateTool);

    const result = (await client.callTool({
      name: 'form_create',
      arguments: { cwd: TEST_CWD, form: FORM },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(errorOf(result)).toEqual({ code: 'NETWORK_ERROR' });
    expect(textOf(result)).toContain('ECONNREFUSED');
    expect(textOf(result)).toContain(`${TEST_PROJECT_URL}/form`);
  });

  it('reports an unconfigured directory as NOT_CONFIGURED with the existing remedy', async () => {
    const client = await connectTools((server) => registerFormCreateTool(server, {}));

    const result = (await client.callTool({
      name: 'form_create',
      arguments: { cwd: '/workspace/no-project-here', form: FORM },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(errorOf(result)).toEqual({ code: 'NOT_CONFIGURED' });
    expect(textOf(result)).toContain('No Form.io project is configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('an error result passes through a client that validates output', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // listTools first: the SDK client caches each tool's output validator from the
  // listing and validates structuredContent against it on every later call.
  it.each([
    ['form_create', registerFormCreateTool, { form: FORM }],
    ['role_list', registerRoleListTool, {}],
  ] as const)('%s', async (name, register, args) => {
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));
    const { client } = await createTestClient(register);
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === name)?.outputSchema).toBeDefined();

    const result = (await client.callTool({
      name,
      arguments: { cwd: TEST_CWD, ...args },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(errorOf(result)?.code).toBe('NOT_FOUND');
    expect(textOf(result).startsWith('[NOT_FOUND] ')).toBe(true);
  });
});
