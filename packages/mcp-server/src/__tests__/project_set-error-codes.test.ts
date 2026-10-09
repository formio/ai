// project_set answers a refusal the way every other tool does: `[CODE] message` in
// the text, and the code under `_meta['io.form/error']`. A refusal of the caller's
// arguments is INVALID_ARGUMENT; a project map that cannot be read is
// CONFIG_UNREADABLE, so the caller does not rewrite a file that is merely unreadable.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  _meta?: Record<string, { code?: string } | undefined>;
}

async function call(args: Record<string, unknown>): Promise<ToolResult> {
  const client = await connectTools((server) =>
    registerProjectSetTool(server, { cwd: () => '/w/server-cwd' })
  );
  return (await client.callTool({ name: 'project_set', arguments: args })) as ToolResult;
}

function textOf(result: ToolResult): string {
  return result.content.map((part) => part.text ?? '').join('\n');
}

describe('project_set refusals carry a code', () => {
  it.each([
    ['a value that is not a URL', { projectUrl: 'not a url', cwd: '/w/a' }, 'must be a valid URL'],
    ['neither URL', { cwd: '/w/b' }, 'Pass at least one of projectUrl or baseUrl'],
    [
      'a deployment for an unmapped directory',
      { baseUrl: 'https://forms.mysite.com', cwd: '/w/c' },
      'projectUrl is required for /w/c',
    ],
  ])('refuses %s with INVALID_ARGUMENT', async (_label, args, expected) => {
    const result = await call(args);

    expect(result.isError).toBe(true);
    expect(textOf(result).startsWith('[INVALID_ARGUMENT] ')).toBe(true);
    expect(textOf(result)).toContain(expected);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
  });

  it('reports an unreadable project map as CONFIG_UNREADABLE', async () => {
    const dir = path.join(os.homedir(), '.formio');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'projects.json'), '{ not json', 'utf8');

    const result = await call({ projectUrl: 'https://next.form.io', cwd: '/w/d' });

    expect(result.isError).toBe(true);
    expect(textOf(result).startsWith('[CONFIG_UNREADABLE] ')).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('CONFIG_UNREADABLE');
  });
});
