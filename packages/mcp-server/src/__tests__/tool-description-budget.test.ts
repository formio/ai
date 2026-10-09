/**
 * The tool list is read into an agent's context on every connect, so its size is a
 * cost every session pays. The budget is measured on the serialized `tools/list`
 * result, the bytes a client actually receives.
 *
 * What repeats is what costs most: the `cwd` description appears on every
 * project-scoped tool, so it says only what to pass and where the full rules are
 * (the server instructions and project_set), which every client receives once.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { connectTools, TEST_CONFIG } from './test-helpers.js';
import { registerAllTools } from '../tools/index.js';
import { SERVER_INSTRUCTIONS } from '../server.js';

const TOOL_LIST_BUDGET = 50_000;
const CWD_DESCRIPTION_BUDGET = 200;

async function listTools(): Promise<Tool[]> {
  const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
  const { tools } = await client.listTools();
  return tools;
}

function cwdDescriptions(tools: Tool[]): Array<{ tool: string; description: string }> {
  return tools.flatMap((tool) => {
    const cwd = (tool.inputSchema.properties ?? {}).cwd as { description?: string } | undefined;
    return cwd ? [{ tool: tool.name, description: cwd.description ?? '' }] : [];
  });
}

describe('tool description budget', () => {
  it(`serializes tools/list in at most ${TOOL_LIST_BUDGET} characters`, async () => {
    const size = JSON.stringify(await listTools()).length;
    expect(size).toBeLessThanOrEqual(TOOL_LIST_BUDGET);
  });

  it(`keeps every cwd description within ${CWD_DESCRIPTION_BUDGET} characters`, async () => {
    const tools = await listTools();
    const descriptions = cwdDescriptions(tools);
    expect(descriptions.length).toBeGreaterThan(0);
    const over = descriptions.filter(
      ({ description }) => description.length > CWD_DESCRIPTION_BUDGET
    );
    expect(over.map(({ tool, description }) => `${tool}: ${description.length}`)).toEqual([]);
  });

  it("says that cwd is the user's working directory and where the full rules are", async () => {
    const missing = cwdDescriptions(await listTools()).filter(
      ({ description }) =>
        !/user's working directory/i.test(description) ||
        !description.includes('project_set') ||
        !/server instructions/i.test(description)
    );
    expect(missing.map(({ tool }) => tool)).toEqual([]);
  });

  // The short description points here, so the full rule has to be here.
  it('leaves the full cwd and resolution rules in the server instructions', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/Pass cwd[^.]*on every project-scoped call/);
    expect(SERVER_INSTRUCTIONS).toMatch(/server's own working directory, which is fixed at spawn/);
    expect(SERVER_INSTRUCTIONS).toMatch(/no environment variable removes the need for it/);
    expect(SERVER_INSTRUCTIONS).toMatch(
      /narrowest-scope-first: a committed formio\.json[\s\S]*?then the per-directory mapping project_set writes, then FORMIO_PROJECT_URL[\s\S]*?weakest/
    );
  });
});
