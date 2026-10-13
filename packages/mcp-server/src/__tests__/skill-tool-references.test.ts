// The skills are read by an agent that then calls the tools they name, with the
// arguments they name. A skill that names a tool the server does not register, or an
// argument a tool's schema does not take, sends the agent into a validation error
// mid-task — and nothing but this check notices when a tool or argument is renamed.
// The check reads the real input schemas, so the skills cannot drift from them. It
// does not ask prose to list a tool's required arguments: the schema gives the agent
// those already.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../tools/index.js';
import { connectTools, TEST_CONFIG } from './test-helpers.js';
import { referenceProblems, type ToolSchemas } from './skill-tool-references.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

async function registeredSchemas(): Promise<ToolSchemas> {
  const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
  const { tools } = await client.listTools();
  return new Map(tools.map((tool: Tool) => [tool.name, tool.inputSchema]));
}

const FIXTURE_SCHEMAS: ToolSchemas = new Map<string, object>([
  [
    'form_list',
    {
      type: 'object',
      properties: {
        cwd: { type: 'string' },
        type: { type: 'string', enum: ['form', 'resource'] },
      },
    },
  ],
  [
    'form_update',
    { type: 'object', properties: { formId: { type: 'string' }, draft: { type: 'boolean' } } },
  ],
]);

describe('the scanner (seeded fixtures)', () => {
  // `=>` and `<` are not brackets: an arrow function or a comparison in a call
  // example must not end the scan or swallow the arguments after it.
  it('checks arguments after an arrow function', () => {
    expect(
      referenceProblems(
        '`form_update({ formId, onDone: () => x, publish: true })`',
        FIXTURE_SCHEMAS
      )
    ).toContain('`form_update` takes no argument `publish`');
  });

  it('checks arguments after a comparison', () => {
    expect(
      referenceProblems('`form_update({ formId, draft: a < b, publish: true })`', FIXTURE_SCHEMAS)
    ).toContain('`form_update` takes no argument `publish`');
  });

  it('flags a tool the server does not register', () => {
    expect(referenceProblems('Call `form_revisions_list` first.', FIXTURE_SCHEMAS)).toEqual([
      'unregistered tool `form_revisions_list`',
    ]);
  });

  it('flags an argument named beside a tool that its schema does not take', () => {
    expect(referenceProblems('Call `form_update` with `publish: true`.', FIXTURE_SCHEMAS)).toEqual([
      '`form_update` takes no argument `publish`',
    ]);
    expect(
      referenceProblems('```\nform_update({ formId: x, publish: true })\n```', FIXTURE_SCHEMAS)
    ).toEqual(['`form_update` takes no argument `publish`']);
  });

  it('flags an enum value the schema does not allow', () => {
    expect(referenceProblems('Call `form_list` with `type: "survey"`.', FIXTURE_SCHEMAS)).toEqual([
      '`form_list` argument `type` allows no value "survey"',
    ]);
  });

  it('accepts a correct reference and a listed look-alike', () => {
    expect(
      referenceProblems(
        'Call `form_update` with `draft: true`, then `form_list` with `type: "resource"`. A `project_url` slot.',
        FIXTURE_SCHEMAS
      )
    ).toEqual([]);
  });

  it('reads a prefixed tool call', () => {
    expect(
      referenceProblems(
        'mcp__formio-mcp__form_update({ formId: x, publish: true })',
        FIXTURE_SCHEMAS
      )
    ).toEqual(['`form_update` takes no argument `publish`']);
  });
});

describe('every skill names only registered tools and their real arguments', () => {
  it('finds no problem in any markdown under plugin/skills', async () => {
    const schemas = await registeredSchemas();
    const problems = markdownFiles(skillsRoot).flatMap((path) =>
      referenceProblems(readFileSync(path, 'utf8'), schemas).map(
        (problem) => `${relative(repoRoot, path)}: ${problem}`
      )
    );
    expect(problems).toEqual([]);
  });
});
