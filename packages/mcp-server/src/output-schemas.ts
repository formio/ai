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
import { CWD_SOURCES } from './workspace-directory.js';

// Field descriptions are kept only on the fields a caller branches on — `ok`, `status`,
// `total`, `hasMore` and `remedy` — because every description here is repeated on every
// tool that returns the document. Every other field is typed and left undescribed: what
// a Form.io field means is the formio-schema skill's to document, and what a project
// report field means is in the server instructions and the report's own `message`.
//
// A Form.io document's schema declares only the fields a caller acts on — the ones the
// skills and the tools read. Every schema is open, so the fields Form.io stores beside
// them (`created`, `owner`, `settings`, `machineName`, …) still pass through untouched;
// declaring them would only lengthen every tool that returns the document.

const looseList = z.array(z.looseObject({}));
// A Mongoose Mixed field: any value, `null` included.
const mixed = z.unknown().optional();

// `access` and `submissionAccess` are declared because the auth skills read them from
// form_get before editing them. They are typed as Mixed rather than as the array (or
// `null`) Form.io stores: the full shape cost more than the rest of the document, on
// every tool that returns a form, and the formio-schema skill documents it.
export const formDocument = z.looseObject({
  _id: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  type: z.string().optional(),
  display: z.string().optional(),
  components: looseList.optional(),
  access: mixed,
  submissionAccess: mixed,
  // "original", "current", or empty/false when history is off.
  revisions: z.union([z.string(), z.boolean()]).optional(),
});

export const roleDocument = z.looseObject({
  _id: z.string().optional(),
  title: z.string().optional(),
  admin: z.boolean().optional(),
  default: z.boolean().optional(),
});

export const actionDocument = z.looseObject({
  _id: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  form: z.string().optional(),
  handler: z.array(z.string()).optional(),
  method: z.array(z.string()).optional(),
  priority: z.number().optional(),
  condition: mixed,
  settings: mixed,
});

// `name` is what action_create and action_type_get take.
const actionTypeFields = {
  name: z.string().optional(),
  title: z.string().optional(),
};

export const actionTypeDocument = z.looseObject(actionTypeFields);

export const actionTypeInfoDocument = z.looseObject({
  ...actionTypeFields,
  // Its components are the keys valid in `settings` on action_create.
  settingsForm: z.looseObject({}).optional(),
});

export const revisionSummaryDocument = z.looseObject({
  // The revision number: what form_revision_get and form_revert take as `version`.
  _vid: z.union([z.string(), z.number()]).optional(),
  _id: z.string().optional(),
  _vnote: z.string().optional(),
  _vuser: z.string().nullish(),
  created: z.string().optional(),
});

export const templateDocument = z.looseObject({
  roles: z.looseObject({}).optional(),
  resources: z.looseObject({}).optional(),
  forms: z.looseObject({}).optional(),
  actions: z.looseObject({}).optional(),
});

// List payloads are wrapped in a named field because structuredContent must be an
// object. `total` is the collection size Form.io reports, not the page length, and
// is left out when Form.io reports none rather than guessed from the page.
function listOutput(key: string, item: z.ZodType) {
  return z.looseObject({
    [key]: z.array(item),
    total: z
      .number()
      .optional()
      .describe(
        'Items Form.io holds for this query, across all pages; absent when Form.io does not report one'
      ),
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
  // For a writer, "it worked" is not "the write reached disk": a record can land and
  // leave the directory no more usable than before, which is the answer the caller acts
  // on. `projectUrl` is the one the next call targets, which under a committed
  // formio.json is the one that file names; `changed` is false when the mapping was
  // already in place; `forced` marks a pair recorded with `project set --force`.
  ok: z
    .boolean()
    .describe(
      'False: the record WAS written but the directory still needs attention; do what `message` names, and do not retry this call'
    ),
  cwd: z.string(),
  projectUrl: z.string(),
  baseUrl: z.string().optional(),
  changed: z.boolean(),
  forced: z.boolean().optional(),
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

// `cwdSource` is where the directory came from, and when to pass cwd on later calls
// because of it is the server instructions' rule. `projectUrl` is absent when status is
// not-configured and `baseUrl` unless it is ok; `message` is the full report, including
// what to do next.
const resolutionFields = {
  cwd: z.string(),
  cwdSource: z.enum(CWD_SOURCES),
  projectUrl: z.string().optional(),
  baseUrl: z.string().optional(),
  projectUrlSource: z.string().optional(),
  baseUrlSource: z.string().optional(),
  message: z.string(),
};

export const projectResolutionOutput = z.looseObject({
  status: resolutionStatus.describe(
    '"ok": proceed. "not-configured": ask the user for a Project URL and record it with project_set. "base-url-unresolved": ask for the Base URL alone and do what the report names. Anything but "ok" blocks.'
  ),
  ...resolutionFields,
  // `forced` marks a pair recorded with `project set --force`, not a reason to distrust
  // it; `shadowed` lists layers a narrower one overrode; `unpaired` lists deployments
  // recorded with no project beside them; `notes` holds anything set aside.
  forced: z.boolean().optional(),
  shadowed: z.array(z.string()),
  unpaired: z.array(z.string()),
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
  notes: z.array(z.string()),
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
