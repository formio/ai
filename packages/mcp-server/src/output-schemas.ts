/**
 * Output schemas for the Form.io tools.
 *
 * Every schema here is deliberately open: it types the fields a caller can rely
 * on and lets the rest through. Form.io documents differ between OSS and
 * Enterprise, gain fields as a project is configured, and carry user-authored
 * component trees that no fixed schema can describe. A closed schema would claim
 * an exhaustiveness the API does not have and would start rejecting valid
 * responses the day a field is added upstream.
 *
 * Openness holds at EVERY level, the top level included. Handed a raw shape,
 * the SDK wraps it in a closed object and publishes `additionalProperties: false`,
 * so each tool's `outputSchema` is passed as a `z.looseObject` instead — never a
 * raw shape, and never a `z.object` anywhere inside one. Fields Form.io stores as
 * Mixed are typed `unknown`: Mixed holds any value, `null` included.
 */

import { z } from 'zod';

// Field descriptions are kept only where a caller branches on the value or passes it
// on; a self-explanatory field (`title`, `created`, …) is typed and left undescribed,
// because every description here is repeated on every tool that returns the document.
const identity = {
  _id: z.string().optional(),
  created: z.string().optional(),
  modified: z.string().optional(),
  machineName: z.string().optional(),
};

const looseList = z.array(z.looseObject({}));
// A Mongoose Mixed field: any value, `null` included.
const mixed = z.unknown().optional();

export const formDocument = z.looseObject({
  ...identity,
  title: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  type: z.string().optional().describe('"form" or "resource"'),
  display: z.string().optional().describe('"form", "wizard" or "pdf"'),
  components: looseList.optional(),
  tags: z.array(z.string()).optional(),
  access: looseList.nullish(),
  submissionAccess: looseList.nullish(),
  revisions: z
    .union([z.string(), z.boolean()])
    .optional()
    .describe('"original", "current", or empty/false when history is off'),
  settings: mixed,
  properties: mixed,
  project: z.string().optional(),
  owner: z.string().nullish(),
});

export const roleDocument = z.looseObject({
  ...identity,
  title: z.string().optional(),
  description: z.string().optional(),
  admin: z.boolean().optional(),
  default: z.boolean().optional(),
  project: z.string().optional(),
});

export const actionDocument = z.looseObject({
  ...identity,
  name: z.string().optional().describe('Action type name'),
  title: z.string().optional(),
  form: z.string().optional(),
  handler: z.array(z.string()).optional(),
  method: z.array(z.string()).optional(),
  priority: z.number().optional(),
  condition: mixed,
  settings: mixed.describe('Type-specific settings; action_type_get gives the schema'),
});

const actionTypeFields = {
  name: z.string().optional().describe('Pass as `name` to action_create'),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
  defaults: z.looseObject({}).optional(),
};

export const actionTypeDocument = z.looseObject(actionTypeFields);

export const actionTypeInfoDocument = z.looseObject({
  ...actionTypeFields,
  settingsForm: z
    .looseObject({})
    .optional()
    .describe('Its components are the keys valid in `settings` on action_create'),
  access: mixed,
});

export const revisionSummaryDocument = z.looseObject({
  _vid: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Revision number; pass as `version` to form_revision_get or form_revert'),
  _id: z.string().optional(),
  _vnote: z.string().optional(),
  _vuser: z.string().nullish(),
  created: z.string().optional(),
  modified: z.string().optional(),
});

export const templateDocument = z.looseObject({
  title: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  roles: z.looseObject({}).optional(),
  resources: z.looseObject({}).optional(),
  forms: z.looseObject({}).optional(),
  actions: z.looseObject({}).optional(),
});

// List payloads are wrapped in a named field because structuredContent must be an
// object. `total` is the collection size Form.io reports, not the page length, so
// `hasMore` can say whether another page exists.
function listOutput(key: string, item: z.ZodType) {
  return z.looseObject({
    [key]: z.array(item),
    total: z.number().describe('Items Form.io holds for this query, across all pages'),
    hasMore: z.boolean().describe('True when items remain; fetch them with a larger `skip`'),
  });
}

export const formsListOutput = listOutput('forms', formDocument);

export const rolesListOutput = listOutput('roles', roleDocument);

export const actionsListOutput = listOutput('actions', actionDocument);

export const actionTypesListOutput = listOutput('actionTypes', actionTypeDocument);

export const revisionsListOutput = listOutput('revisions', revisionSummaryDocument);

/** For tools whose only meaningful answer is "it worked". */
const acknowledgementShape = {
  ok: z.boolean(),
  message: z.string(),
};

export const acknowledgementOutput = z.looseObject(acknowledgementShape);

export const projectMappingOutput = z.looseObject({
  ...acknowledgementShape,
  // Overridden: for a writer, "it worked" is not "the write reached disk" — a record
  // can land and leave the directory no more usable than before, which is the answer
  // the caller has to act on.
  ok: z
    .boolean()
    .describe(
      'True when the directory is ready for a deployment call. False: the record WAS written, but a committed formio.json governs and supplies no Base URL — make the edit `message` names; do not retry'
    ),
  cwd: z.string(),
  projectUrl: z
    .string()
    .describe(
      'Project URL the next call targets; under a committed formio.json, the one that file names, not the one recorded here'
    ),
  baseUrl: z.string().optional().describe('The deployment serving `projectUrl`, from its record'),
  changed: z
    .boolean()
    .describe('False when the mapping was already in place; true means the record changed'),
  forced: z
    .boolean()
    .optional()
    .describe(
      'True when the pair was recorded with `project set --force`; not a reason to re-record it'
    ),
});

/**
 * What `project_get` reports: the resolved configuration, where each half came
 * from, and which of the three answers this is.
 *
 * `status` carries what the CLI's exit codes carry, and for the same reason —
 * callers branch on the outcome, and a substring of the message is not a
 * contract. `ok` is the only status with both URLs; `base-url-unresolved` has a
 * project and no deployment; `not-configured` has neither.
 */
const resolutionStatus = z.enum(['ok', 'not-configured', 'base-url-unresolved']);

const resolutionFields = {
  cwd: z.string(),
  projectUrl: z.string().optional().describe('Absent when status is not-configured'),
  baseUrl: z.string().optional().describe('Absent unless status is ok'),
  projectUrlSource: z
    .string()
    .optional()
    .describe('committed, mapping, or environment (the weakest)'),
  baseUrlSource: z
    .string()
    .optional()
    .describe('committed, mapping, environment, derived, or unresolved'),
  message: z.string().describe('The full report, including what to do next'),
};

export const projectResolutionOutput = z.looseObject({
  status: resolutionStatus.describe(
    '"ok": proceed. "not-configured": ask the user for a Project URL and record it with project_set. "base-url-unresolved": ask for the Base URL alone and do what the report names. Anything but "ok" blocks.'
  ),
  ...resolutionFields,
  forced: z
    .boolean()
    .optional()
    .describe(
      'True when the pair was recorded with `project set --force`; not a reason to distrust it'
    ),
  shadowed: z.array(z.string()).describe('Layers overridden by a narrower one'),
  unpaired: z
    .array(z.string())
    .describe('Deployments recorded with no project beside them, so unreadable'),
  remedy: z
    .looseObject({
      tool: z.string(),
      arguments: z.record(z.string(), z.string()),
      supply: z.array(z.string()).describe('Arguments to ask the user for'),
    })
    .optional()
    .describe(
      'The fix as a call: ask the user for `supply`, add it to `arguments`, call `tool`. Absent when status is "ok" or the fix is an edit to a committed formio.json'
    ),
  notes: z.array(z.string()).describe('Anything set aside while resolving'),
});

/**
 * What `server_status` reports: which server is answering, and the same resolution
 * project_get reports for the caller's directory. Only the fields a caller branches
 * on are documented here; the rest of project_get's report passes through.
 */
export const serverStatusOutput = z.looseObject({
  name: z.string(),
  version: z.string(),
  status: resolutionStatus.describe("As project_get's `status`"),
  ...resolutionFields,
});
