// The planner's checked-in examples are copied literally by agents, so a
// permission the Access Matrix promises but the template.json never grants —
// or grants more broadly than promised — is worse than no example at all.
//
// Every rule below was derived by reading the Form.io server source, not by
// inference from the skill docs. The paths, for anyone re-verifying:
//
//   formio/src/middleware/addSubmissionResourceAccess.js:34-90
//     On POST/PUT/PATCH the row's `access` is WIPED and rebuilt from components:
//     each component carrying `submissionAccess` contributes
//     `{ type, resources: [<referencedSubmissionId>] }` per entry. The type is
//     passed through verbatim.
//
//   formio-server/src/actions/GroupAction.js:180-190
//     Group Assignment writes the GROUP SUBMISSION's `_id` into the USER
//     submission's `roles`. Group membership is therefore an id in user.roles.
//
//   formio-server/src/hooks/settings.js:852-908
//     The enterprise `getAccess` re-adds verified group ids to `access.roles`
//     after formio's own `.intersection(validRoles)` strips them (permissionHandler
//     :441-447). Without this, nothing group-based would resolve at all.
//
//   formio/src/middleware/permissionHandler.js:45-125  (single-row resolve)
//     Row access types map to the compiled list as:
//       read/create/update/delete -> the matching `<op>_all`
//       write                     -> read + create + update  (NOT delete)
//       admin                     -> all four
//     then `hasAccess` intersects with `access.roles` (:681).
//
//   formio/src/middleware/permissionHandler.js:390-392  (create)
//     On POST, `getAccessBasedOnMethod(..., ['create','write','admin'])` reads the
//     group reference OUT OF THE SUBMITTED BODY and grants `create_all` for that
//     group id. So group-based create DOES work — it does not require a
//     form-level create grant. It requires the block to carry create/write/admin
//     and the payload to carry the group reference as an object with `_id`.
//
//   formio/src/middleware/submissionResourceAccessFilter.js:20-56  (list)
//     A row appears in an index request only via `type IN (read, write, admin)`
//     matching the caller's roles, or by ownership.
//
//   formio/src/util/util.js:921-946  (reference population)
//     `checkReferenceReadAccess` populates a referenced row only on `read_all`
//     role intersection, ownership, or admin. GROUP MEMBERSHIP DOES NOT HELP.
//     Consequence: the group resource itself needs a real `read_all` grant for
//     an end-user role, both to render its name and to populate the
//     `dataSrc: resource` select whose value is what authorizes group-based
//     create. There is no membership-scoped read of a group's own row, because
//     nothing stamps that row's `access`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const examplesRoot = join(repoRoot, 'plugin/skills/formio-resource-planner/references/examples');

type AccessEntry = { type?: string; roles?: string[] };

type Component = {
  key?: string;
  type?: string;
  data?: { resource?: string };
  submissionAccess?: AccessEntry[];
  components?: Component[];
  columns?: Component[];
  rows?: Component[][];
};

type FormEntry = {
  name?: string;
  submissionAccess?: AccessEntry[];
  components?: Component[];
};

type ActionEntry = {
  name?: string;
  form?: string;
  method?: string[];
  settings?: { group?: string; user?: string; resource?: string };
};

type Template = {
  roles?: Record<string, unknown>;
  forms?: Record<string, FormEntry>;
  resources?: Record<string, FormEntry>;
  actions?: Record<string, ActionEntry>;
};

type MatrixRow = {
  resource: string;
  actor: string;
  create: string;
  read: string;
  update: string;
  delete: string;
};

const OPERATIONS = ['create', 'read', 'update', 'delete'] as const;
type Operation = (typeof OPERATIONS)[number];

function exampleDirs(): string[] {
  return readdirSync(examplesRoot).filter((entry) =>
    statSync(join(examplesRoot, entry)).isDirectory()
  );
}

// "TeamUser" in the matrix is `teamUser` in the template; "Team" is `team`.
function machineNameOf(matrixResource: string): string {
  const collapsed = matrixResource.trim().replace(/\s+/g, '');
  return collapsed.charAt(0).toLowerCase() + collapsed.slice(1);
}

function parseAccessMatrix(markdown: string): MatrixRow[] {
  const section = markdown.split(/^## Access Matrix$/m)[1];
  if (section === undefined) {
    throw new Error('template.md has no `## Access Matrix` section');
  }
  const body = section.split(/^## /m)[0];
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|[\s|:-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, line.endsWith('|') ? -1 : undefined)
        .split('|')
        .map((cell) => cell.trim())
    )
    .filter((cells) => cells.length >= 6 && cells[0] !== 'Resource')
    .map((cells) => ({
      resource: cells[0],
      actor: cells[1],
      create: cells[2],
      read: cells[3],
      update: cells[4],
      delete: cells[5],
    }));
}

function resourceEntries(template: Template): [string, FormEntry][] {
  return Object.entries(template.resources ?? {});
}

function entriesOf(template: Template, machineName: string): AccessEntry[] | undefined {
  const entry = template.resources?.[machineName] ?? template.forms?.[machineName];
  return entry?.submissionAccess;
}

function grants(entries: AccessEntry[] | undefined, type: string, role: string): boolean {
  return (entries ?? []).some((entry) => entry.type === type && (entry.roles ?? []).includes(role));
}

function childComponents(component: Component): Component[] {
  return [
    ...(component.components ?? []),
    ...(component.columns ?? []),
    ...(component.rows ?? []).flat(),
  ];
}

function flatten(components: Component[] | undefined): Component[] {
  return (components ?? []).flatMap((component) => [
    component,
    ...flatten(childComponents(component)),
  ]);
}

// A field-based block is one or more bare CRUD entries with empty `roles` — the
// marker that tells the server to stamp the saved row's ACL from the referenced
// group. The four-entry form is the common one, but a read-only block
// (`{ "type": "read", "roles": [] }`) is equally canonical, and is the right
// instrument when group members should SEE rows an administrator alone manages.
// Row-access type -> the operations it actually confers (permissionHandler.js:45-125).
const IMPLIED_OPERATIONS: Record<string, Operation[]> = {
  read: ['read'],
  create: ['create'],
  update: ['update'],
  delete: ['delete'],
  write: ['read', 'create', 'update'],
  admin: ['read', 'create', 'update', 'delete'],
};

// Types that make a row visible to an index request
// (submissionResourceAccessFilter.js:20-56).
const LIST_VISIBLE = new Set(['read', 'write', 'admin']);

function fieldBasedOperations(component: Component): Set<string> {
  const entries = component.submissionAccess ?? [];
  const bare = entries.filter(
    (entry) =>
      entry.type !== undefined &&
      IMPLIED_OPERATIONS[entry.type] !== undefined &&
      (entry.roles ?? []).length === 0
  );
  return new Set(bare.flatMap((entry) => IMPLIED_OPERATIONS[entry.type as string]));
}

function listVisibleViaBlock(entry: FormEntry | undefined): boolean {
  return flatten(entry?.components).some((component) =>
    (component.submissionAccess ?? []).some(
      (access) =>
        access.type !== undefined &&
        LIST_VISIBLE.has(access.type) &&
        (access.roles ?? []).length === 0
    )
  );
}

// The group resources of a template: for each Group Assignment action, the
// resource that the join's `settings.group` field points at.
function groupResourcesOf(template: Template): Set<string> {
  const joins = Object.values(template.actions ?? {}).filter((action) => action.name === 'group');
  const named = joins.flatMap((action) => {
    const joinKey = action.form;
    const groupField = action.settings?.group;
    if (!joinKey || !groupField) {
      return [];
    }
    const join = template.resources?.[joinKey] ?? template.forms?.[joinKey];
    const component = flatten(join?.components).find((entry) => entry.key === groupField);
    const resource = component?.data?.resource;
    return resource ? [resource] : [];
  });
  return new Set(named);
}

describe.each(exampleDirs())('planner example %s', (example) => {
  const dir = join(examplesRoot, example);
  const template = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8')) as Template;
  const matrix = parseAccessMatrix(readFileSync(join(dir, 'template.md'), 'utf8'));

  it('has a non-empty Access Matrix', () => {
    expect(matrix.length).toBeGreaterThan(0);
  });

  it('names only resources and roles the template declares', () => {
    for (const row of matrix) {
      const machineName = machineNameOf(row.resource);
      expect(
        entriesOf(template, machineName) !== undefined ||
          template.resources?.[machineName] !== undefined ||
          template.forms?.[machineName] !== undefined,
        `matrix row "${row.resource} | ${row.actor}" names no resource or form in template.json`
      ).toBe(true);
      expect(
        Object.keys(template.roles ?? {}),
        `matrix actor "${row.actor}" is not a declared role`
      ).toContain(row.actor);
    }
  });

  // The regression this suite exists for.
  it('backs every create cell the way the server actually authorizes a create', () => {
    // `all`/`own` come from the resource's own submissionAccess. `group` does NOT
    // need one: permissionHandler.js:390-392 grants create_all from the block's
    // create/write/admin entry, keyed to the group in the submitted payload.
    for (const row of matrix) {
      if (row.create === '—') {
        continue;
      }
      const machineName = machineNameOf(row.resource);
      const entries = entriesOf(template, machineName);
      if (row.create.startsWith('group')) {
        const entry = template.resources?.[machineName] ?? template.forms?.[machineName];
        const covered = new Set(
          flatten(entry?.components).flatMap((component) => [...fieldBasedOperations(component)])
        );
        expect(
          covered.has('create'),
          `${machineName}: matrix says ${row.actor} may create by group, but no component's field-based block carries create/write/admin, so nothing grants create_all for the referenced group`
        ).toBe(true);
        continue;
      }
      const wanted = row.create === 'all' ? 'create_all' : 'create_own';
      expect(
        grants(entries, wanted, row.actor),
        `${machineName}: matrix says ${row.actor} create = \`${row.create}\`, but submissionAccess has no ${wanted} entry for that role`
      ).toBe(true);
    }
  });

  it('grants the static read/update/delete the matrix promises', () => {
    const staticScopes: Record<string, string> = { all: '_all', own: '_own' };
    for (const row of matrix) {
      for (const operation of ['read', 'update', 'delete'] as Operation[]) {
        const suffix = staticScopes[row[operation]];
        if (suffix === undefined) {
          continue; // `—`, `group`, `group(<j>)`, `role(<r>)` — nothing static to assert
        }
        const machineName = machineNameOf(row.resource);
        const type = `${operation}${suffix}`;
        expect(
          grants(entriesOf(template, machineName), type, row.actor),
          `${machineName}: matrix says ${row.actor} has ${operation} \`${row[operation]}\`, but submissionAccess has no ${type} entry for that role`
        ).toBe(true);
      }
    }
  });

  it('grants no more than the Access Matrix promises', () => {
    const justified: Record<string, string[]> = {
      _all: ['all'],
      _own: ['own', 'group'], // `create | group` legitimately maps to create_own
    };
    for (const [machineName, entry] of resourceEntries(template)) {
      for (const access of entry.submissionAccess ?? []) {
        const parsed = /^(create|read|update|delete)(_all|_own)$/.exec(access.type ?? '');
        if (!parsed) {
          continue;
        }
        const [, operation, scope] = parsed;
        for (const role of access.roles ?? []) {
          if (role === 'administrator') {
            continue; // the admin row is `all` across the board by convention
          }
          const row = matrix.find(
            (candidate) =>
              machineNameOf(candidate.resource) === machineName && candidate.actor === role
          );
          const cell = row?.[operation as Operation];
          expect(
            cell !== undefined && justified[scope].includes(cell),
            `${machineName}: submissionAccess grants ${access.type} to ${role}, but the Access Matrix says ${operation} = ${cell === undefined ? '(no row for this actor)' : `\`${cell}\``}. A grant wider than the matrix is a leak — every ${role} would reach every row.`
          ).toBe(true);
        }
      }
    }
  });

  it('grants no owner-scoped access to a role that cannot create the rows', () => {
    // A `_own` grant resolves against the row's `owner`, which Form.io sets to
    // whoever submitted it. If the role has no create path on the resource, the
    // rows belong to someone else and the grant matches nothing.
    const savedInto = new Set(
      Object.values(template.actions ?? {})
        .filter((action) => action.name === 'save')
        .map((action) => action.settings?.resource)
        .filter((resource): resource is string => Boolean(resource))
    );
    for (const [machineName, entry] of resourceEntries(template)) {
      if (savedInto.has(machineName)) {
        continue; // rows arrive via another form's Save; that form owns the create path
      }
      const entries = entry.submissionAccess ?? [];
      for (const access of entries) {
        if (!/_own$/.test(access.type ?? '') || access.type === 'create_own') {
          continue;
        }
        for (const role of (access.roles ?? []).filter(
          (candidate) => candidate !== 'administrator'
        )) {
          const canCreate =
            grants(entries, 'create_own', role) || grants(entries, 'create_all', role);
          expect(
            canCreate,
            `${machineName}: ${access.type} for ${role} is inert — that role has no create grant here, so every row is owned by whoever does create them (the administrator). Use the group-reference field-based block if ${role} should see these rows.`
          ).toBe(true);
        }
      }
    }
  });

  it('lets every Group Assignment action fire on update and delete, not just create', () => {
    // GroupAction.resolve() computes membership by diffing the submitted row against
    // req.previousSubmission into groupsToAdd/groupsToRemove, so a membership MOVE
    // fires on update and a REVOCATION fires on delete. `method: ["create"]` means
    // neither ever runs: memberships can be granted and never moved or withdrawn.
    // GroupAction.info() itself defaults to all three.
    const groupActions = Object.entries(template.actions ?? {}).filter(
      ([, action]) => action.name === 'group'
    );
    expect(groupActions.length).toBeGreaterThan(0);
    for (const [key, action] of groupActions) {
      expect(
        [...(action.method ?? [])].sort(),
        `${key}: a Group Assignment action must fire on create, update and delete — otherwise membership changes and revocations silently never happen`
      ).toEqual(['create', 'delete', 'update']);
    }
  });

  it('never claims group-scoped access on a group resource itself', () => {
    // Nothing stamps a group row's own `access`: addSubmissionResourceAccess builds
    // it from the row's OWN components, and a group resource carries no reference to
    // itself. Membership also cannot populate it — checkReferenceReadAccess
    // (util.js:921-946) consults read_all/ownership only. So a `group` cell on the
    // group resource promises access the server will never grant.
    const groupResources = groupResourcesOf(template);
    for (const row of matrix) {
      const machineName = machineNameOf(row.resource);
      if (!groupResources.has(machineName)) {
        continue;
      }
      for (const operation of OPERATIONS) {
        expect(
          row[operation].startsWith('group'),
          `${machineName} is the group resource, but the matrix gives ${row.actor} ${operation} = \`${row[operation]}\`. Nothing stamps a group row's own access — use \`all\` (the group's name must be readable to populate the dataSrc:resource select) or \`—\`.`
        ).toBe(false);
      }
    }
  });

  it('backs every `group` cell with a field-based block covering that operation', () => {
    const groupResources = groupResourcesOf(template);
    for (const row of matrix) {
      const machineName = machineNameOf(row.resource);
      if (groupResources.has(machineName)) {
        continue; // the group's own rows carry the ACL the Group Assignment writes
      }
      const entry = template.resources?.[machineName] ?? template.forms?.[machineName];
      const covered = new Set(
        flatten(entry?.components).flatMap((component) => [...fieldBasedOperations(component)])
      );
      // `create | group` is satisfied by the create grant, checked above.
      for (const operation of ['read', 'update', 'delete'] as Operation[]) {
        if (!row[operation].startsWith('group')) {
          continue;
        }
        expect(
          covered.has(operation),
          `${machineName}: matrix says ${row.actor} has ${operation} \`${row[operation]}\`, but no component's field-based submissionAccess block carries a bare \`${operation}\` entry — nothing stamps that right onto the saved row`
        ).toBe(true);
      }
    }
  });
});
