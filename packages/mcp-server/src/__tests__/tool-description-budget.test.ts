/**
 * The tool list is read into an agent's context on every connect, so its size is a
 * cost every session pays. The budget is measured on the serialized `tools/list`
 * result, the bytes a client actually receives.
 *
 * What repeats is what costs most: the `cwd` description appears on every
 * project-scoped tool, so it says only that it is optional and what it defaults to,
 * and leaves when to pass it, and the rest of the rules, to the server instructions,
 * which every client receives once.
 *
 * A description is kept where a caller acts on it. On an output schema that is the
 * fields a caller branches on; every other field is typed and left undescribed. On an
 * input schema it is every argument this server defines; the fields nested inside a
 * form, action or role body are Form.io's own, documented by the formio-schema and
 * formio-actions skills, so they carry none — except where this server gives one a
 * meaning of its own (`form.revisions`, which `acceptNoHistory` depends on).
 *
 * A Form.io document's output schema is open, so a field it does not declare still
 * passes through. It declares only the fields a caller acts on — the ones the skills
 * and the tools read — rather than every field Form.io stores.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { connectTools, TEST_CONFIG } from './test-helpers.js';
import { registerAllTools } from '../tools/index.js';
import { SERVER_INSTRUCTIONS } from '../server.js';
import {
  actionDocument,
  actionTypeDocument,
  actionTypeInfoDocument,
  formDocument,
  revisionSummaryDocument,
  roleDocument,
  templateDocument,
} from '../output-schemas.js';

const TOOL_LIST_BUDGET = 42_000;
const CWD_DESCRIPTION_BUDGET = 100;

// Output fields a caller branches on, by path from the result's root (`[]` steps into
// an array's items). Every other output field carries no description.
const DESCRIBED_OUTPUT_FIELDS = ['ok', 'status', 'total', 'hasMore', 'remedy', 'remedy.supply'];

// The fields each Form.io document's output schema declares: the ones a caller acts on.
// `access` and `submissionAccess` stay on a form because the auth skills read them from
// form_get before editing them.
const DECLARED_DOCUMENT_FIELDS = [
  {
    name: 'form',
    schema: formDocument,
    fields: [
      '_id',
      'title',
      'name',
      'path',
      'type',
      'display',
      'components',
      'revisions',
      'access',
      'submissionAccess',
    ],
  },
  {
    name: 'action',
    schema: actionDocument,
    fields: [
      '_id',
      'name',
      'title',
      'form',
      'handler',
      'method',
      'settings',
      'condition',
      'priority',
    ],
  },
  { name: 'role', schema: roleDocument, fields: ['_id', 'title', 'admin', 'default'] },
  {
    name: 'revision summary',
    schema: revisionSummaryDocument,
    fields: ['_id', '_vid', '_vnote', '_vuser', 'created'],
  },
  { name: 'action type', schema: actionTypeDocument, fields: ['name', 'title'] },
  {
    name: 'action type info',
    schema: actionTypeInfoDocument,
    fields: ['name', 'title', 'settingsForm'],
  },
  {
    name: 'template',
    schema: templateDocument,
    fields: ['roles', 'resources', 'forms', 'actions'],
  },
];

const ANNOTATION_TITLE_WORDS = 4;

// The arguments this server defines, as opposed to Form.io's own body fields: each
// keeps its description wherever it appears.
const SERVER_ARGUMENTS = [
  'cwd',
  'note',
  'draft',
  'acceptNoHistory',
  'formId',
  'formIdOrPath',
  'version',
  'limit',
  'skip',
  'sort',
  'select',
  'tags',
  'projectUrl',
  'baseUrl',
];

// Body fields, by tool and path, that this server gives a meaning of its own.
const DESCRIBED_BODY_FIELDS: Record<string, string[]> = {
  form_create: ['form.revisions'],
  form_update: ['form.revisions'],
};

async function listTools(): Promise<Tool[]> {
  const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
  const { tools } = await client.listTools();
  return tools;
}

interface SchemaNode {
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode | SchemaNode[];
  additionalProperties?: SchemaNode | boolean;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  allOf?: SchemaNode[];
}

// Every path under `node` that carries a description, `node` itself included.
function describedPaths(node: SchemaNode | undefined, at: string): string[] {
  if (!node || typeof node !== 'object') return [];
  const join = (step: string) => (at === '' ? step : `${at}.${step}`);
  const items = node.items === undefined ? [] : [node.items].flat();
  const additional =
    typeof node.additionalProperties === 'object' ? [node.additionalProperties] : [];
  return [
    ...(node.description !== undefined && at !== '' ? [at] : []),
    ...Object.entries(node.properties ?? {}).flatMap(([name, child]) =>
      describedPaths(child, join(name))
    ),
    ...items.flatMap((child) => describedPaths(child, `${at}[]`)),
    ...additional.flatMap((child) => describedPaths(child, join('{}'))),
    ...[...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])].flatMap((child) =>
      describedPaths(child, at)
    ),
  ];
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

  it('says that cwd is optional and defaults to the client workspace root', async () => {
    const missing = cwdDescriptions(await listTools()).filter(
      ({ description }) =>
        !/optional/i.test(description) ||
        !/defaults to the client's workspace root/i.test(description)
    );
    expect(missing.map(({ tool }) => tool)).toEqual([]);
  });

  it('describes only the output fields a caller branches on', async () => {
    const extra = (await listTools()).flatMap((tool) =>
      describedPaths(tool.outputSchema as SchemaNode | undefined, '')
        .filter((field) => !DESCRIBED_OUTPUT_FIELDS.includes(field))
        .map((field) => `${tool.name}: ${field}`)
    );
    expect(extra).toEqual([]);
  });

  it('tells a project_set caller what a false `ok` means', async () => {
    const tool = (await listTools()).find(({ name }) => name === 'project_set');
    const ok = (tool?.outputSchema?.properties ?? {}).ok as SchemaNode | undefined;
    expect(ok?.description).toMatch(/WAS written/);
    expect(ok?.description).toMatch(/message/);
    expect(ok?.description).toMatch(/do not retry/i);
    expect((ok?.description ?? '').length).toBeLessThanOrEqual(130);
  });

  it.each(DECLARED_DOCUMENT_FIELDS)(
    'declares only the $name fields a caller acts on, none of them required',
    ({ schema, fields }) => {
      expect(Object.keys(schema.shape).sort()).toEqual([...fields].sort());
      const json = schema.toJSONSchema() as { required?: string[] };
      expect(json.required ?? []).toEqual([]);
    }
  );

  it(`keeps every annotation title within ${ANNOTATION_TITLE_WORDS} words`, async () => {
    const long = (await listTools())
      .map(({ name, annotations }) => ({ name, title: annotations?.title ?? '' }))
      .filter(({ title }) => title.split(/\s+/).length > ANNOTATION_TITLE_WORDS);
    expect(long.map(({ name, title }) => `${name}: ${title}`)).toEqual([]);
  });

  it('keeps the description on every argument this server defines', async () => {
    const tools = await listTools();
    const missing = tools.flatMap((tool) => {
      const properties = (tool.inputSchema.properties ?? {}) as Record<string, SchemaNode>;
      return SERVER_ARGUMENTS.filter(
        (name) => name in properties && !properties[name].description
      ).map((name) => `${tool.name}: ${name}`);
    });
    const unseen = SERVER_ARGUMENTS.filter(
      (name) => !tools.some((tool) => name in (tool.inputSchema.properties ?? {}))
    );
    expect(missing).toEqual([]);
    expect(unseen).toEqual([]);
  });

  it('leaves Form.io body fields to the skills, except those the server defines', async () => {
    const tools = await listTools();
    const described = tools.flatMap((tool) =>
      Object.entries((tool.inputSchema.properties ?? {}) as Record<string, SchemaNode>).flatMap(
        ([name, argument]) =>
          describedPaths({ ...argument, description: undefined }, name).map((field) => ({
            tool: tool.name,
            field,
          }))
      )
    );
    const extra = described.filter(
      ({ tool, field }) => !(DESCRIBED_BODY_FIELDS[tool] ?? []).includes(field)
    );
    const missing = Object.entries(DESCRIBED_BODY_FIELDS).flatMap(([tool, fields]) =>
      fields
        .filter((field) => !described.some((entry) => entry.tool === tool && entry.field === field))
        .map((field) => `${tool}: ${field}`)
    );
    expect(extra.map(({ tool, field }) => `${tool}: ${field}`)).toEqual([]);
    expect(missing).toEqual([]);
  });

  // The short description points here, so the full rule has to be here: the order a
  // directory is chosen in, and when an agent passes cwd itself.
  it('leaves the full cwd and resolution rules in the server instructions', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(
      /cwd argument[\s\S]*?client's workspace roots[\s\S]*?CLAUDE_PROJECT_DIR[\s\S]*?server's own working directory/
    );
    expect(SERVER_INSTRUCTIONS).toMatch(/several roots[^.]*INVALID_ARGUMENT/);
    expect(SERVER_INSTRUCTIONS).toMatch(
      /cwdSource is "server" or "claude-project-dir"[^.]*pass cwd/
    );
    expect(SERVER_INSTRUCTIONS).not.toMatch(/on every project-scoped call/);
    expect(SERVER_INSTRUCTIONS).toMatch(
      /narrowest-scope-first: a committed formio\.json[\s\S]*?then the per-directory mapping project_set writes, then FORMIO_PROJECT_URL[\s\S]*?weakest/
    );
  });
});
