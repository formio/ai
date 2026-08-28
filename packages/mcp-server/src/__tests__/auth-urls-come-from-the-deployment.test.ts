import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedFormioConfig } from '../config.js';

/**
 * The auth path builds its URLs from the DEPLOYMENT, and caches per project where the
 * answer is project-scoped. Both claims were unpinned.
 *
 * Every fixture on this path used to pair `https://formio.invalid/example` with
 * `https://formio.invalid` — the one shape where the deployment, the project's origin
 * and the derived parent path all coincide. So an assertion could not tell "built from
 * the deployment" from "built from the project's own host", and building the portal
 * login URL or `${baseUrl}/current` from the wrong one passed the entire suite. That is
 * exactly the "a deployment you do not use" failure the refuse-to-guess-a-base-URL
 * rule exists to prevent: the login page and the token it returns would belong to a
 * server the user never configured.
 *
 * These use a project whose deployment is neither its origin NOR its own URL, so each
 * assertion can only pass by reading the deployment.
 */
const DEPLOYMENT = 'https://forms.invalid/enterprise';
const PROJECT = 'https://forms.invalid/enterprise/myproject';

const config: ResolvedFormioConfig = {
  baseUrl: DEPLOYMENT,
  projectUrl: PROJECT,
  cwd: '/workspace/app',
  projectUrlSource: 'mapping',
};

describe('auth URLs are built from the deployment, not the project’s host', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('probes the deployment for the portal login form', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        seen.push(String(input));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ _id: 'login-form-id' }),
          text: async () => '{"_id":"login-form-id"}',
        } as unknown as Response;
      })
    );

    const { resolveDefaultLoginFormUrl } = await import('../auth.js');
    const resolved = await resolveDefaultLoginFormUrl(config);

    expect(resolved).toBe(`${DEPLOYMENT}/formio/user/login`);
    // And it is the deployment that was probed — not the project's origin, which
    // would be https://forms.invalid, nor the project itself.
    expect(seen[0]).toContain(`${DEPLOYMENT}/formio/user/login`);
    expect(seen[0]).not.toContain('https://forms.invalid/formio/user/login');
  });

  // The candidates after the first are project-scoped, so a key that omits the
  // project would serve one project's login form to a session targeting another on
  // the same deployment — the ordinary case for two projects under one Enterprise
  // install, and for every project on the hosted cloud, which all share one base URL.
  it('does not serve one project’s login form to another on the same deployment', async () => {
    const answers = new Map<string, boolean>([
      [`${DEPLOYMENT}/formio/user/login`, false],
      [`${PROJECT}/admin/login`, true],
      [`${DEPLOYMENT}/other/admin/login`, false],
      [`${DEPLOYMENT}/other/user/login`, true],
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input).split('?')[0];
        const found = answers.get(url) ?? false;
        return {
          ok: found,
          status: found ? 200 : 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => (found ? { _id: 'form-id' } : {}),
          text: async () => (found ? '{"_id":"form-id"}' : '{}'),
        } as unknown as Response;
      })
    );

    const { resolveDefaultLoginFormUrl } = await import('../auth.js');

    const first = await resolveDefaultLoginFormUrl(config);
    const second = await resolveDefaultLoginFormUrl({
      ...config,
      projectUrl: `${DEPLOYMENT}/other`,
    });

    expect(first).toBe(`${PROJECT}/admin/login`);
    // A cache keyed on the deployment alone would hand back the first project's form.
    expect(second).toBe(`${DEPLOYMENT}/other/user/login`);
  });

  // The Security Module probe is an anonymous GET to the DEPLOYMENT's config.js.
  // Built from the project instead it fetches a path that does not serve that file,
  // silently resolves "unlicensed", and strips a user's revisions setting on every
  // write — and the only assertions on it were prose about what it does.
  it('probes the deployment for the Security Module flag', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        seen.push(String(input));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/javascript' }),
          text: async () => 'window.config = { premium: true };',
        } as unknown as Response;
      })
    );

    const { gateRevisionsLicense } = await import('../revisions/license.js');
    const server = { server: { createMessage: undefined } } as never;
    await gateRevisionsLicense(server, config, {
      actionLabel: 'create',
      requiresRevisions: false,
      form: { title: 'Contact' },
    }).catch(() => undefined);

    expect(seen[0], `probed ${seen[0]}`).toBe(`${DEPLOYMENT}/config.js`);
  });

  it('validates a token against the deployment', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        seen.push(String(input));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ _id: 'user' }),
          text: async () => '{"_id":"user"}',
        } as unknown as Response;
      })
    );

    const { validateToken } = await import('../token-validation.js');
    await validateToken({ ...config, jwt: 'a-token' });

    expect(seen[0]).toBe(`${DEPLOYMENT}/current`);
    expect(seen[0]).not.toBe('https://forms.invalid/current');
  });
});
