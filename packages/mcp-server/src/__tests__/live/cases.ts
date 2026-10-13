/**
 * The live cases, in the order they run: each exercises one tool against the real
 * project, and later cases build on what earlier ones created (recorded in `state`).
 * Every entity a case creates carries the run's prefix so clean-up can find it.
 *
 * Kept as data rather than test blocks so the default suite can check, with no
 * deployment, that every registered tool has a case (coverage.test.ts).
 */

import type { ExpectStatic } from 'vitest';
import type { ToolOutcome } from './harness.js';

export interface LiveContext {
  call(tool: string, args?: Record<string, unknown>): Promise<ToolOutcome>;
  expect: ExpectStatic;
  prefix: string;
  projectUrl: string;
  /** A directory with no mapping of its own, for project_set; clean-up clears it. */
  scratchDir: string;
  state: Record<string, unknown>;
}

export interface LiveCase {
  tool: string;
  name: string;
  run(ctx: LiveContext): Promise<void>;
}

type Components = Array<Record<string, unknown>>;

const field = (key: string, label: string, type = 'textfield'): Record<string, unknown> => ({
  type,
  key,
  label,
  input: true,
});
const submit = { type: 'button', key: 'submit', label: 'Submit', action: 'submit', input: true };

const probeForm = (prefix: string, components: Components): Record<string, unknown> => ({
  title: `MCP Live ${prefix}`,
  name: `${prefix}probe`,
  path: `${prefix}probe`,
  type: 'form',
  display: 'form',
  components,
});

const emailAction = (title: string): Record<string, unknown> => ({
  name: 'email',
  title,
  handler: ['after'],
  method: ['create'],
  priority: 0,
  settings: {
    transport: 'default',
    emails: ['probe@example.com'],
    subject: title,
    message: '{{ submission(data, form.components) }}',
  },
});

const ok = (ctx: LiveContext, outcome: ToolOutcome): Record<string, unknown> => {
  ctx.expect(outcome.isError, `${outcome.code ?? ''} ${outcome.text}`).toBe(false);
  return outcome.structured ?? {};
};

const refused = (ctx: LiveContext, outcome: ToolOutcome, code: string): void => {
  ctx.expect(outcome.isError, outcome.text).toBe(true);
  ctx.expect(outcome.code, outcome.text).toBe(code);
};

const required = <T>(ctx: LiveContext, key: string): T => {
  const value = ctx.state[key];
  ctx.expect(value, `an earlier case did not record ${key}`).toBeDefined();
  return value as T;
};

const names = (list: unknown, key: string): unknown[] =>
  Array.isArray(list) ? list.map((item) => (item as Record<string, unknown>)[key]) : [];

const tagName = (prefix: string): string => `0.0.1-${prefix}`;

/** Revisions need a separately licensed package; a deployment without it refuses them. */
const revisionsLicensed = (ctx: LiveContext): boolean => ctx.state.revisionsLicensed !== false;

export const LIVE_CASES: readonly LiveCase[] = [
  {
    tool: 'server_status',
    name: 'reports the resolved project',
    async run(ctx) {
      const status = ok(ctx, await ctx.call('server_status'));
      ctx.expect(status.projectUrl).toBe(ctx.projectUrl);
    },
  },
  {
    tool: 'project_get',
    name: 'reports the resolved project and its sources',
    async run(ctx) {
      const report = ok(ctx, await ctx.call('project_get'));
      ctx.expect(report.status).toBe('ok');
      ctx.expect(report.projectUrl).toBe(ctx.projectUrl);
    },
  },
  {
    tool: 'project_tag_list',
    name: 'lists the version tags newest first',
    async run(ctx) {
      const listing = ok(ctx, await ctx.call('project_tag_list'));
      ctx.expect(Array.isArray(listing.tags)).toBe(true);
    },
  },
  {
    tool: 'form_list',
    name: 'lists forms with the paging contract',
    async run(ctx) {
      const listing = ok(ctx, await ctx.call('form_list', { limit: 2 }));
      ctx.expect(Array.isArray(listing.forms)).toBe(true);
      ctx.expect(typeof listing.total).toBe('number');
    },
  },
  {
    tool: 'form_create',
    name: 'creates the probe form',
    async run(ctx) {
      const outcome = await ctx.call('form_create', {
        form: probeForm(ctx.prefix, [field('name', 'Name'), submit]),
        note: 'MCP live run probe',
      });
      const form = ok(ctx, outcome);
      ctx.expect(form.path).toBe(`${ctx.prefix}probe`);
      ctx.state.formId = form._id;
    },
  },
  {
    tool: 'form_get',
    name: 'reads the probe form by path and by id',
    async run(ctx) {
      const formId = required<string>(ctx, 'formId');
      const byPath = ok(ctx, await ctx.call('form_get', { formIdOrPath: `${ctx.prefix}probe` }));
      ctx.expect(byPath._id).toBe(formId);
      const byId = ok(
        ctx,
        await ctx.call('form_get', { formIdOrPath: formId, select: '_id,path' })
      );
      ctx.expect(byId.path).toBe(`${ctx.prefix}probe`);
    },
  },
  {
    tool: 'form_update',
    name: 'adds a field to the live form',
    async run(ctx) {
      const formId = required<string>(ctx, 'formId');
      const form = ok(
        ctx,
        await ctx.call('form_update', {
          formId,
          form: probeForm(ctx.prefix, [
            field('name', 'Name'),
            field('email', 'Email', 'email'),
            submit,
          ]),
          note: 'Add email',
          acceptNoHistory: true,
        })
      );
      ctx.expect(names(form.components, 'key')).toContain('email');
    },
  },
  {
    tool: 'form_update',
    name: 'saves a draft, or names the missing revisions licence',
    async run(ctx) {
      const formId = required<string>(ctx, 'formId');
      const outcome = await ctx.call('form_update', {
        formId,
        form: probeForm(ctx.prefix, [field('name', 'Name'), submit]),
        note: 'Draft without email',
        draft: true,
      });
      if (outcome.code === 'LICENSE_REQUIRED') {
        ctx.state.revisionsLicensed = false;
        return;
      }
      ok(ctx, outcome);
      const draft = ok(ctx, await ctx.call('form_get', { formIdOrPath: formId, draft: true }));
      ctx.expect(names(draft.components, 'key')).not.toContain('email');
    },
  },
  {
    tool: 'form_publish',
    name: 'publishes the draft',
    async run(ctx) {
      const outcome = await ctx.call('form_publish', {
        formId: required<string>(ctx, 'formId'),
        note: 'Publish draft',
      });
      if (!revisionsLicensed(ctx)) {
        refused(ctx, outcome, 'LICENSE_REQUIRED');
        return;
      }
      ctx.expect(names(ok(ctx, outcome).components, 'key')).not.toContain('email');
    },
  },
  {
    tool: 'form_revision_list',
    name: 'lists the probe form revisions',
    async run(ctx) {
      const outcome = await ctx.call('form_revision_list', {
        formIdOrPath: required<string>(ctx, 'formId'),
      });
      const listing = ok(ctx, outcome);
      ctx.expect(Array.isArray(listing.revisions)).toBe(true);
      if (revisionsLicensed(ctx)) {
        ctx.expect(names(listing.revisions, '_vid')).toContain(0);
      }
    },
  },
  {
    tool: 'form_revision_get',
    name: 'reads revision 0',
    async run(ctx) {
      const outcome = await ctx.call('form_revision_get', {
        formIdOrPath: required<string>(ctx, 'formId'),
        version: '0',
      });
      if (!revisionsLicensed(ctx)) {
        ctx.expect(outcome.isError).toBe(true);
        return;
      }
      ctx.expect(names(ok(ctx, outcome).components, 'key')).toEqual(['name', 'submit']);
    },
  },
  {
    tool: 'form_revert',
    name: 'reverts to revision 0',
    async run(ctx) {
      const outcome = await ctx.call('form_revert', {
        formId: required<string>(ctx, 'formId'),
        version: '0',
        note: 'Revert to revision 0',
      });
      if (!revisionsLicensed(ctx)) {
        refused(ctx, outcome, 'LICENSE_REQUIRED');
        return;
      }
      ctx.expect(names(ok(ctx, outcome).components, 'key')).toEqual(['name', 'submit']);
    },
  },
  {
    tool: 'form_revert',
    name: 'refuses to revert to the draft',
    async run(ctx) {
      refused(
        ctx,
        await ctx.call('form_revert', {
          formId: required<string>(ctx, 'formId'),
          version: 'draft',
          note: 'Revert to draft',
        }),
        'INVALID_ARGUMENT'
      );
    },
  },
  {
    tool: 'role_list',
    name: 'lists the roles',
    async run(ctx) {
      const listing = ok(ctx, await ctx.call('role_list'));
      ctx.expect(Array.isArray(listing.roles)).toBe(true);
    },
  },
  {
    tool: 'role_create',
    name: 'creates the probe role',
    async run(ctx) {
      const role = ok(
        ctx,
        await ctx.call('role_create', {
          role: { title: `${ctx.prefix} role`, description: 'MCP live run probe' },
        })
      );
      ctx.state.roleId = role._id;
    },
  },
  {
    tool: 'role_update',
    name: 'updates the probe role',
    async run(ctx) {
      const role = ok(
        ctx,
        await ctx.call('role_update', {
          roleId: required<string>(ctx, 'roleId'),
          role: { title: `${ctx.prefix} role`, description: 'MCP live run probe (updated)' },
        })
      );
      ctx.expect(role.description).toBe('MCP live run probe (updated)');
    },
  },
  {
    tool: 'action_type_list',
    name: 'lists the action types for the probe form',
    async run(ctx) {
      const listing = ok(
        ctx,
        await ctx.call('action_type_list', { formId: required<string>(ctx, 'formId') })
      );
      ctx.expect(names(listing.actionTypes, 'name')).toContain('email');
    },
  },
  {
    tool: 'action_type_get',
    name: 'reads the email action type',
    async run(ctx) {
      const info = ok(
        ctx,
        await ctx.call('action_type_get', {
          formId: required<string>(ctx, 'formId'),
          actionName: 'email',
        })
      );
      ctx.expect(info.name).toBe('email');
    },
  },
  {
    tool: 'action_list',
    name: 'lists the default Save action',
    async run(ctx) {
      const listing = ok(
        ctx,
        await ctx.call('action_list', { formId: required<string>(ctx, 'formId') })
      );
      ctx.expect(names(listing.actions, 'name')).toContain('save');
    },
  },
  {
    tool: 'action_create',
    name: 'creates an email action',
    async run(ctx) {
      const action = ok(
        ctx,
        await ctx.call('action_create', {
          formId: required<string>(ctx, 'formId'),
          action: emailAction('Live probe email'),
        })
      );
      ctx.state.actionId = action._id;
    },
  },
  {
    tool: 'action_get',
    name: 'reads the email action',
    async run(ctx) {
      const action = ok(
        ctx,
        await ctx.call('action_get', {
          formId: required<string>(ctx, 'formId'),
          actionId: required<string>(ctx, 'actionId'),
        })
      );
      ctx.expect(action.title).toBe('Live probe email');
    },
  },
  {
    tool: 'action_update',
    name: 'updates the email action',
    async run(ctx) {
      const action = ok(
        ctx,
        await ctx.call('action_update', {
          formId: required<string>(ctx, 'formId'),
          actionId: required<string>(ctx, 'actionId'),
          action: emailAction('Live probe email (updated)'),
        })
      );
      ctx.expect(action.title).toBe('Live probe email (updated)');
    },
  },
  {
    tool: 'action_delete',
    name: 'deletes the email action',
    async run(ctx) {
      ok(
        ctx,
        await ctx.call('action_delete', {
          formId: required<string>(ctx, 'formId'),
          actionId: required<string>(ctx, 'actionId'),
        })
      );
    },
  },
  {
    tool: 'project_export',
    name: 'exports the project including the probe form',
    async run(ctx) {
      const template = ok(ctx, await ctx.call('project_export'));
      ctx
        .expect(Object.keys((template.forms as Record<string, unknown>) ?? {}))
        .toContain(`${ctx.prefix}probe`);
    },
  },
  {
    tool: 'project_import',
    name: 'imports a one-form template',
    async run(ctx) {
      ok(
        ctx,
        await ctx.call('project_import', {
          template: {
            title: 'MCP live run',
            version: '2.0.0',
            roles: {},
            resources: {},
            actions: {},
            forms: {
              [`${ctx.prefix}import`]: {
                title: `MCP Live Import ${ctx.prefix}`,
                name: `${ctx.prefix}import`,
                path: `${ctx.prefix}import`,
                type: 'form',
                display: 'form',
                components: [field('name', 'Name'), submit],
              },
            },
          },
        })
      );
      ok(ctx, await ctx.call('form_get', { formIdOrPath: `${ctx.prefix}import`, select: '_id' }));
    },
  },
  {
    tool: 'project_tag_create',
    name: 'creates a semver tag that becomes the current version',
    async run(ctx) {
      const created = ok(
        ctx,
        await ctx.call('project_tag_create', {
          tag: tagName(ctx.prefix),
          description: 'MCP live run probe tag',
        })
      );
      ctx.expect(created.tag).toBe(tagName(ctx.prefix));
      const listing = ok(ctx, await ctx.call('project_tag_list'));
      ctx.expect(listing.current).toBe(tagName(ctx.prefix));
      ctx.expect(names(listing.tags, 'tag')[0]).toBe(tagName(ctx.prefix));
    },
  },
  {
    tool: 'project_export',
    name: 'exports the tag, with the project access filled in',
    async run(ctx) {
      const template = ok(ctx, await ctx.call('project_export', { tag: tagName(ctx.prefix) }));
      ctx
        .expect(Object.keys((template.forms as Record<string, unknown>) ?? {}))
        .toContain(`${ctx.prefix}probe`);
      ctx.expect(Array.isArray(template.access) && template.access.length > 0).toBe(true);
    },
  },
  {
    tool: 'project_tag_list',
    name: 'reports a form changed since the current tag',
    async run(ctx) {
      ok(
        ctx,
        await ctx.call('form_update', {
          formId: required<string>(ctx, 'formId'),
          form: probeForm(ctx.prefix, [field('name', 'Name'), field('phone', 'Phone'), submit]),
          note: 'Add phone after the tag',
          acceptNoHistory: true,
        })
      );
      const listing = ok(ctx, await ctx.call('project_tag_list', { compare: true }));
      const comparison = (listing.comparison ?? {}) as Record<string, Record<string, unknown>>;
      ctx.expect(comparison.forms?.changed).toContain(`${ctx.prefix}probe`);
    },
  },
  {
    tool: 'project_tag_create',
    name: 'refuses a name that is not semver, before any request',
    async run(ctx) {
      refused(
        ctx,
        await ctx.call('project_tag_create', { tag: 'release-3', description: 'not semver' }),
        'INVALID_ARGUMENT'
      );
    },
  },
  {
    tool: 'project_tag_create',
    name: 'refuses a name the project family already has',
    async run(ctx) {
      refused(
        ctx,
        await ctx.call('project_tag_create', { tag: tagName(ctx.prefix), description: 'again' }),
        'VALIDATION_FAILED'
      );
    },
  },
  {
    tool: 'project_export',
    name: 'reports an unknown tag as not found',
    async run(ctx) {
      refused(ctx, await ctx.call('project_export', { tag: '9.9.9-nope' }), 'NOT_FOUND');
    },
  },
  {
    tool: 'project_set',
    name: 'records a mapping that project_get then reports',
    async run(ctx) {
      ok(ctx, await ctx.call('project_set', { cwd: ctx.scratchDir, projectUrl: ctx.projectUrl }));
      const report = ok(ctx, await ctx.call('project_get', { cwd: ctx.scratchDir }));
      ctx.expect(report.projectUrl).toBe(ctx.projectUrl);
      ctx.expect(report.projectUrlSource).toBe('mapping');
    },
  },
];
