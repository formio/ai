import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, templateTransferTimeoutMs } from '../formio-client.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { acknowledgementOutput } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';
import { FormioNetworkError, ToolError } from '../tool-errors.js';

// What Form.io's importer reads before anything else: `forms` and `resources`
// unconditionally, `roles` and `actions` when present. A template that gets any of
// them wrong fails server-side with a 500, so it is refused here, naming the key.
// Every other key (reports, revisions, name, …) passes through untouched.
const REQUIRED_SECTIONS = ['forms', 'resources'] as const;
const OPTIONAL_SECTIONS = ['roles', 'actions'] as const;

function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function describeValue(value: unknown): string {
  if (value === undefined) {
    return 'missing';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  return value === null ? 'null' : `a ${typeof value}`;
}

function refuseMalformedTemplate(template: Record<string, unknown>): void {
  const malformed = [
    ...REQUIRED_SECTIONS.filter((key) => !isPlainObject(template[key])),
    ...OPTIONAL_SECTIONS.filter((key) => key in template && !isPlainObject(template[key])),
  ];
  const [key] = malformed;
  if (key === undefined) {
    return;
  }
  throw new ToolError({
    code: 'INVALID_ARGUMENT',
    message: `The template's \`${key}\` is ${describeValue(template[key])}. Form.io templates key each entry by machine name, so \`${key}\` must be an object such as {"contact": {...}}; an empty object is fine. \`forms\` and \`resources\` are required, and \`roles\` and \`actions\` are objects when present. Nothing was imported.`,
  });
}

// The client stopped waiting; the server may not have. Retrying blind imports the
// template a second time on top of whatever the first attempt merged.
function explainTimeout(error: unknown): unknown {
  if (!(error instanceof FormioNetworkError) || error.timeoutMs === undefined) {
    return error;
  }
  return new ToolError({
    code: error.code,
    message: `${error.message} | The import may still complete on the server: check the project with project_export before retrying.`,
    cause: error,
  });
}

export function registerProjectImportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_import',
    {
      description:
        "Import a template's roles, resources, forms and actions into the project `cwd` resolves to, for a first build: build it with the formio-resource-planner skill. Each form it names is replaced, its actions deleted and recreated, and its `access` replaces the project's; change an existing project with the form, role and action tools instead.",
      inputSchema: {
        cwd: cwdSchema,
        template: z.looseObject({}).describe('The template JSON object to import'),
      },
      outputSchema: acknowledgementOutput,
      annotations: overwrites('Import a project template'),
    },
    async ({ cwd, template }) => {
      try {
        refuseMalformedTemplate(template);
        const cfg = await resolveToolConfig({ server, cwd, config });
        const result = await formioFetch('import', {}, cfg, {
          method: 'POST',
          body: { template },
          responseType: 'text',
          timeoutMs: templateTransferTimeoutMs(cfg),
        });
        // The endpoint answers with a short status string rather than a document,
        // so it is passed through as the text view unchanged.
        const message = String(result);
        return toMcpStructuredResult({ ok: true, message }, message);
      } catch (error) {
        return toMcpError(explainTimeout(error));
      }
    }
  );
}
