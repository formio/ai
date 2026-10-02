/**
 * Live checks of the Form.io behavior the agent-submission design rests on (design Q1,
 * Q2). Skipped unless a non-production deployment is named:
 *
 *   FORMIO_IT_PROJECT_URL  a sandbox project, e.g. https://form.local/sandbox
 *   FORMIO_IT_ADMIN_TOKEN  an admin JWT for that project's deployment
 *
 * The suite creates two scratch forms and one scratch user, and deletes all three.
 * A deployment behind a certificate the OS trusts but Node does not needs
 * NODE_USE_SYSTEM_CA=1. Timeouts are generous because a `.local` host resolves over
 * mDNS, which can add seconds to every request.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'crypto';

const PROJECT_URL = process.env.FORMIO_IT_PROJECT_URL?.replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.FORMIO_IT_ADMIN_TOKEN;
const LIVE = Boolean(PROJECT_URL && ADMIN_TOKEN);

const suffix = randomBytes(4).toString('hex');
const SETUP_TIMEOUT = 180_000;
const TEST_TIMEOUT = 120_000;
// Every scratch form this suite creates is named with this prefix, so a run that died
// before cleanup is tidied up by the next one — and nothing else is ever touched.
const SCRATCH_NAME = /^mcpIt(Target|Scratch)[0-9a-f]{8}$/;

async function api(
  path: string,
  {
    method = 'GET',
    body,
    token = ADMIN_TOKEN,
  }: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const url = path.startsWith('http') ? path : `${PROJECT_URL}/${path.replace(/^\//, '')}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-jwt-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // Plain-text bodies (DELETE returns "OK") stay as text.
  }
  return { status: response.status, json, headers: response.headers };
}

function ok<T>(result: { status: number; json: unknown }, what: string): T {
  expect(result.status, `${what}: ${JSON.stringify(result.json).slice(0, 300)}`).toBeLessThan(300);
  return result.json as T;
}

type Doc = Record<string, unknown> & { _id: string };

describe.skipIf(!LIVE)(
  'live Form.io behavior behind the agent-submission design',
  { timeout: TEST_TIMEOUT },
  () => {
    let adminId: string;
    let targetId: string;
    let formId: string;
    let userSubmissionId: string | undefined;
    const cleanup: string[] = [];

    beforeAll(async () => {
      const leftovers = ok<Doc[]>(
        await api('form?limit=100&select=_id,name&name__regex=^mcpIt'),
        'find leftovers'
      );
      for (const form of leftovers.filter((f) => SCRATCH_NAME.test(String(f.name)))) {
        await api(`form/${form._id}`, { method: 'DELETE' });
      }
      const base = PROJECT_URL!.replace(/\/[^/]+$/, '');
      adminId = ok<Doc>(await api(`${base}/current`), 'current user')._id;

      const roles = ok<Doc[]>(await api('role'), 'roles');
      const authenticated = roles.find((r) => /authenticated/i.test(String(r.title)));
      expect(authenticated, 'project has an Authenticated role').toBeDefined();

      const target = ok<Doc>(
        await api('form', {
          method: 'POST',
          body: {
            title: `MCP IT target ${suffix}`,
            name: `mcpItTarget${suffix}`,
            path: `mcpittarget${suffix}`,
            type: 'resource',
            components: [{ type: 'textfield', key: 'note', label: 'Note', input: true }],
          },
        }),
        'create target resource'
      );
      targetId = target._id;
      cleanup.push(`form/${targetId}`);

      const form = ok<Doc>(
        await api('form', {
          method: 'POST',
          body: {
            title: `MCP IT scratch ${suffix}`,
            name: `mcpItScratch${suffix}`,
            path: `mcpitscratch${suffix}`,
            type: 'form',
            submissionAccess: [
              { type: 'create_own', roles: [authenticated!._id] },
              { type: 'read_own', roles: [authenticated!._id] },
            ],
            components: [
              {
                type: 'textfield',
                key: 'name',
                label: 'Name',
                input: true,
                validate: { required: true },
              },
              {
                type: 'textfield',
                key: 'status',
                label: 'Status',
                input: true,
                defaultValue: 'open',
              },
              { type: 'number', key: 'qty', label: 'Qty', input: true },
              {
                type: 'number',
                key: 'total',
                label: 'Total',
                input: true,
                calculateValue: 'value = (data.qty || 0) * 2;',
                calculateServer: true,
              },
              { type: 'button', key: 'submit', label: 'Submit', input: true },
            ],
          },
        }),
        'create scratch form'
      );
      formId = form._id;
      cleanup.push(`form/${formId}`);

      // An observable action: when it runs, a row appears in the target resource.
      ok(
        await api(`form/${formId}/action`, {
          method: 'POST',
          body: {
            name: 'save',
            title: 'Copy to target',
            handler: ['before'],
            method: ['create', 'update'],
            priority: 5,
            settings: { resource: targetId, fields: { note: 'name' } },
          },
        }),
        'add copy-to-target action'
      );
      // A form created over the API may carry no save action; add one so real writes persist.
      const actions = ok<Doc[]>(await api(`form/${formId}/action`), 'list actions');
      if (
        !actions.some(
          (a) => a.name === 'save' && !(a.settings as Record<string, unknown>)?.resource
        )
      ) {
        ok(
          await api(`form/${formId}/action`, {
            method: 'POST',
            body: {
              name: 'save',
              title: 'Save Submission',
              handler: ['before'],
              method: ['create', 'update'],
              priority: 10,
              settings: {},
            },
          }),
          'add save action'
        );
      }
    }, SETUP_TIMEOUT);

    afterAll(async () => {
      if (!LIVE) return;
      if (userSubmissionId) await api(`user/submission/${userSubmissionId}`, { method: 'DELETE' });
      for (const path of cleanup.reverse()) await api(path, { method: 'DELETE' });
    }, SETUP_TIMEOUT);

    const count = async (id: string) =>
      ok<Doc[]>(await api(`form/${id}/submission?limit=100&select=_id`), `count ${id}`).length;

    it('Q1: a dry-run POST returns normalized data, saves nothing, and runs no action', async () => {
      const dry = ok<Doc>(
        await api(`form/${formId}/submission?dryrun=1`, {
          method: 'POST',
          body: { data: { name: 'x', qty: 3 } },
        }),
        'dry-run POST'
      );
      const data = dry.data as Record<string, unknown>;
      expect(data.status, 'default filled').toBe('open');
      expect(data.total, 'server-calculated value filled').toBe(6);
      expect(await count(formId), 'no record saved').toBe(0);
      expect(await count(targetId), 'no action ran').toBe(0);
    });

    it('Q1: the real write stores exactly the dry-run data, with the same owner', async () => {
      const body = { data: { name: 'y', qty: 4 } };
      const dry = ok<Doc>(
        await api(`form/${formId}/submission?dryrun=1`, { method: 'POST', body }),
        'dry run'
      );
      const real = ok<Doc>(
        await api(`form/${formId}/submission`, { method: 'POST', body: { data: dry.data } }),
        'real POST'
      );
      const stored = ok<Doc>(await api(`form/${formId}/submission/${real._id}`), 'GET stored');
      expect(stored.data).toEqual(dry.data);
      expect(stored.owner).toEqual(dry.owner ?? stored.owner);
      expect(await count(targetId), 'the real write ran the action').toBe(1);
    });

    it('Q1: a dry-run PUT returns normalized data and changes nothing', async () => {
      const real = ok<Doc>(
        await api(`form/${formId}/submission`, {
          method: 'POST',
          body: { data: { name: 'before', qty: 1 } },
        }),
        'seed'
      );
      const targetsBefore = await count(targetId);
      const dry = ok<Doc>(
        await api(`form/${formId}/submission/${real._id}?dryrun=1`, {
          method: 'PUT',
          body: { data: { name: 'after', qty: 5 } },
        }),
        'dry-run PUT'
      );
      expect((dry.data as Record<string, unknown>).total).toBe(10);
      const stored = ok<Doc>(
        await api(`form/${formId}/submission/${real._id}`),
        'GET after dry PUT'
      );
      expect((stored.data as Record<string, unknown>).name).toBe('before');
      expect(await count(targetId), 'no update action ran').toBe(targetsBefore);
    });

    it('Q2: metadata.agent is stored verbatim', async () => {
      const agent = { source: 'agent', session: 's', purpose: 'test', sig: 'g' };
      const real = ok<Doc>(
        await api(`form/${formId}/submission`, {
          method: 'POST',
          body: { data: { name: 'm' }, metadata: { agent } },
        }),
        'POST with tag'
      );
      const stored = ok<Doc>(await api(`form/${formId}/submission/${real._id}`), 'GET tagged');
      expect((stored.metadata as Record<string, unknown>).agent).toEqual(agent);
    });

    it('Q2: a non-admin cannot set owner to the admin', async () => {
      const email = `mcp-it+${suffix}@example.com`;
      const password = `It-${randomBytes(9).toString('hex')}`;
      const user = ok<Doc>(
        await api('user/submission', { method: 'POST', body: { data: { email, password } } }),
        'create scratch user'
      );
      userSubmissionId = user._id;

      const login = await api('user/login', {
        method: 'POST',
        body: { data: { email, password } },
        token: '',
      });
      ok(login, 'user login');
      const userToken = login.headers.get('x-jwt-token') ?? undefined;
      expect(userToken, 'login returned a token').toBeTruthy();

      const created = ok<Doc>(
        await api(`form/${formId}/submission`, {
          method: 'POST',
          body: { data: { name: 'u' }, owner: adminId },
          token: userToken,
        }),
        'POST as non-admin with owner set to the admin'
      );
      expect(created.owner, 'owner is the caller, not the admin').toBe(user._id);
    });
  }
);
