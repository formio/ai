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
 * Shapes (plain objects of zod types) are what `registerTool` accepts for
 * `outputSchema`; `*Document` values are the same content as a schema, for
 * nesting inside arrays.
 */

import { z } from 'zod';

const identity = {
  _id: z.string().optional().describe('Form.io document ID (24-character hex)'),
  created: z.string().optional().describe('ISO 8601 creation timestamp'),
  modified: z.string().optional().describe('ISO 8601 last-modified timestamp'),
  machineName: z.string().optional().describe('Machine-readable unique name within the project'),
};

export const formShape = {
  ...identity,
  title: z.string().optional().describe('Human-readable form title'),
  name: z.string().optional().describe('API name of the form'),
  path: z.string().optional().describe('URL path the form is served at, relative to the project'),
  type: z.string().optional().describe('"form" for a form, "resource" for a data resource'),
  display: z.string().optional().describe('Render style: "form" or "wizard"'),
  components: z
    .array(z.looseObject({}))
    .optional()
    .describe('Component tree defining the fields, layout, and logic of the form'),
  tags: z.array(z.string()).optional().describe('Tags applied to the form'),
  access: z
    .array(z.looseObject({}))
    .optional()
    .describe('Role-based access to the form definition itself'),
  submissionAccess: z
    .array(z.looseObject({}))
    .optional()
    .describe('Role-based access to the submissions of this form'),
  revisions: z
    .union([z.string(), z.boolean()])
    .optional()
    .describe('Revision mode: "original", "current", or false when disabled'),
  settings: z.looseObject({}).optional().describe('Form-level settings'),
  properties: z.looseObject({}).optional().describe('Custom key/value properties'),
  project: z.string().optional().describe('ID of the project owning the form'),
  owner: z.string().nullish().describe('ID of the submission owner, when set'),
};

export const formDocument = z.looseObject(formShape);

export const roleShape = {
  ...identity,
  title: z.string().optional().describe('Human-readable role title'),
  description: z.string().optional().describe('What the role is for'),
  admin: z.boolean().optional().describe('Whether the role grants administrative access'),
  default: z
    .boolean()
    .optional()
    .describe('Whether the role is assigned to anonymous or newly registered users'),
  project: z.string().optional().describe('ID of the project owning the role'),
};

export const roleDocument = z.looseObject(roleShape);

export const actionShape = {
  ...identity,
  name: z.string().optional().describe('Action type name, e.g. "save", "login", "email"'),
  title: z.string().optional().describe('Human-readable action title'),
  form: z.string().optional().describe('ID of the form the action runs on'),
  handler: z
    .array(z.string())
    .optional()
    .describe('When the action runs relative to submission handling: "before" and/or "after"'),
  method: z
    .array(z.string())
    .optional()
    .describe('Submission methods the action responds to, e.g. "create", "update"'),
  priority: z.number().optional().describe('Execution order; higher runs first'),
  condition: z.looseObject({}).optional().describe('Condition gating whether the action runs'),
  settings: z
    .looseObject({})
    .optional()
    .describe('Action-type-specific settings; see action_type_get for the schema'),
};

export const actionDocument = z.looseObject(actionShape);

export const actionTypeDocument = z.looseObject({
  name: z.string().optional().describe('Action type name to pass as `name` to action_create'),
  title: z.string().optional().describe('Human-readable action type title'),
  description: z.string().optional().describe('What the action type does'),
  priority: z.number().optional().describe('Default execution priority'),
  defaults: z.looseObject({}).optional().describe('Default settings applied on creation'),
});

export const actionTypeInfoShape = {
  name: z.string().optional().describe('Action type name to pass as `name` to action_create'),
  title: z.string().optional().describe('Human-readable action type title'),
  description: z.string().optional().describe('What the action type does'),
  priority: z.number().optional().describe('Default execution priority'),
  defaults: z.looseObject({}).optional().describe('Default settings applied on creation'),
  settingsForm: z
    .looseObject({})
    .optional()
    .describe(
      'Form definition describing the settings this action type accepts; its components are the keys valid in `settings` on action_create'
    ),
  access: z.looseObject({}).optional().describe('Access requirements for configuring the action'),
};

export const revisionSummaryDocument = z.looseObject({
  _vid: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Revision number; pass as `version` to form_revision_get'),
  _id: z.string().optional().describe('Revision document ID'),
  _vnote: z.string().optional().describe('Note recorded with the revision'),
  modified: z.string().optional().describe('ISO 8601 timestamp the revision was published'),
  user: z
    .union([z.string(), z.looseObject({})])
    .nullish()
    .describe('User who published the revision'),
});

export const templateShape = {
  title: z.string().optional().describe('Project title'),
  name: z.string().optional().describe('Project machine name'),
  version: z.string().optional().describe('Template schema version'),
  description: z.string().optional().describe('Project description'),
  roles: z.looseObject({}).optional().describe('Roles, keyed by machine name'),
  resources: z.looseObject({}).optional().describe('Resource forms, keyed by machine name'),
  forms: z.looseObject({}).optional().describe('Forms, keyed by machine name'),
  actions: z.looseObject({}).optional().describe('Actions, keyed by machine name'),
};

// List payloads are wrapped in a named field because structuredContent must be an
// object, and `count` is stated rather than left to be derived so a caller can see
// at a glance whether a page was truncated by `limit`.
export const formsListShape = {
  forms: z.array(formDocument).describe('Matching forms, in the requested sort order'),
  count: z.number().describe('Number of forms returned by this call'),
};

export const rolesListShape = {
  roles: z.array(roleDocument).describe('Roles defined in the project'),
  count: z.number().describe('Number of roles returned'),
};

export const actionsListShape = {
  actions: z.array(actionDocument).describe('Actions configured on the form'),
  count: z.number().describe('Number of actions returned'),
};

export const actionTypesListShape = {
  actionTypes: z
    .array(actionTypeDocument)
    .describe('Action types this deployment supports for the form'),
  count: z.number().describe('Number of action types returned'),
};

export const revisionsListShape = {
  revisions: z
    .array(revisionSummaryDocument)
    .describe('Published revision summaries, newest first'),
  count: z.number().describe('Number of revisions returned'),
};

/** For tools whose only meaningful answer is "it worked". */
export const acknowledgementShape = {
  ok: z.boolean().describe('True when the operation completed'),
  message: z.string().describe('Human-readable result detail'),
};

export const projectMappingShape = {
  ...acknowledgementShape,
  // Overridden: for a writer, "it worked" is not "the write reached disk" — a record
  // can land and leave the directory no more usable than before, which is the answer
  // the caller has to act on.
  ok: z
    .boolean()
    .describe(
      'True when the directory is ready for a deployment call. False means the record WAS written and the directory still resolves no Base URL, because a committed formio.json governs it and supplies none — `message` then carries the report naming the file and the key to add. Do not retry this call; make that edit'
    ),
  cwd: z.string().describe('Working directory the mapping is keyed against'),
  projectUrl: z
    .string()
    .describe(
      'Project URL now ACTIVE for that directory — what the next tool call will target. Usually the project this call just recorded; where a committed formio.json governs the directory, it is the project THAT file names, because the mapping written here takes effect only if that file goes away. The message says so when the two differ'
    ),
  baseUrl: z
    .string()
    .optional()
    .describe(
      "The deployment that serves `projectUrl`, from the same record — never one record's project beside another record's deployment"
    ),
  changed: z
    .boolean()
    .describe(
      'False when the requested mapping was already in place and nothing was written. True means the RECORD changed, which is not necessarily the same as the ACTIVE project changing — a committed formio.json still outranks it'
    ),
};

/**
 * What `project_get` reports: the resolved configuration, where each half came
 * from, and which of the three answers this is.
 *
 * `status` carries what the CLI's exit codes carry, and for the same reason —
 * callers branch on the outcome, and a substring of the message is not a
 * contract. `ok` is the only status with both URLs; `base-url-unresolved` has a
 * project and no deployment; `not-configured` has neither.
 */
export const projectResolutionShape = {
  status: z
    .enum(['ok', 'not-configured', 'base-url-unresolved'])
    .describe(
      'Which of the three answers this is: "ok" — both URLs resolved; "not-configured" — nothing is mapped for this directory, so ask the user for a Project URL and record it with project_set; "base-url-unresolved" — the project is recorded and its deployment could not be derived, so ask for the Base URL alone and record it with project_set. Treat anything other than "ok" as blocking.'
    ),
  cwd: z.string().describe('Working directory the resolution was performed for'),
  projectUrl: z
    .string()
    .optional()
    .describe('Project URL that resolves for that directory; absent when status is not-configured'),
  baseUrl: z
    .string()
    .optional()
    .describe('Deployment hosting that project; absent unless status is ok'),
  projectUrlSource: z
    .string()
    .optional()
    .describe(
      'Which layer supplied the project URL: committed (a formio.json found by walking up), mapping (the per-directory record project_set writes), or environment (FORMIO_PROJECT_URL, the weakest source)'
    ),
  baseUrlSource: z
    .string()
    .optional()
    .describe(
      'Which layer supplied the base URL: committed, mapping, environment, derived (read off the project URL), or unresolved'
    ),
  shadowed: z
    .array(z.string())
    .describe('Layers that could have supplied a URL and were overridden, in precedence order'),
  unpaired: z
    .array(z.string())
    .describe(
      'Values that were overridden by nothing: a deployment recorded with no project beside it, so nothing says which project it serves and it cannot be read. Separate from `shadowed` because the fix differs — a shadowed value is in the wrong record, an unpaired one is in an incomplete record'
    ),
  message: z.string().describe('The full human-readable report, including what to do next'),
  remedy: z
    .object({
      tool: z.string().describe('The tool to call — always project_set'),
      arguments: z
        .record(z.string(), z.string())
        .describe(
          'Arguments this report already knows: the cwd, and the project where one applies'
        ),
      supply: z
        .array(z.string())
        .describe('The arguments to ask the USER for — one value, added to the arguments above'),
    })
    .optional()
    .describe(
      'The same remedy the message states, as a call: ask the user for the argument named in `supply`, add it to `arguments`, and call the tool. Absent when the status is "ok" — and absent when no call fixes the state: a deployment missing from a committed formio.json is recorded by editing that file, whose path and key the message names, because this server never writes a committed file. Acting on this rather than parsing the message is what keeps a caller from composing a call the server would refuse — which write reaches the record holding the project depends on that record'
    ),
  notes: z
    .array(z.string())
    .describe(
      'Anything set aside while resolving — an unreadable mapping a committed formio.json made irrelevant, a stored value that is not a URL, or the directory this answer is about when no cwd was passed. A URL the server dropped as unusable at startup is on its stderr rather than here, because it was never a candidate for this resolution'
    ),
};
