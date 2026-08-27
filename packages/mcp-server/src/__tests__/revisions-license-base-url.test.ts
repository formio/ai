import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('../revisions/browser-prompts.js', () => ({
  requestRevisionsLicenseConsent: vi.fn(),
}));

import { gateRevisionsLicense } from '../revisions/license.js';
import { requestRevisionsLicenseConsent } from '../revisions/browser-prompts.js';

const mockConsent = vi.mocked(requestRevisionsLicenseConsent);
const server = {} as McpServer;

// The Security Module flag lives on the deployment, fetched anonymously from
// ${baseUrl}/config.js. With no base URL there is nothing to ask — and the two
// obvious shortcuts are both wrong: refusing every call would break an API-key
// write that never needed the answer, while assuming "unlicensed" silently
// strips a `revisions` setting the user wrote.
describe('the revisions license gate with an unresolved base URL', () => {
  const unresolved: ResolvedFormioConfig = {
    projectUrl: 'https://myproject.mysite.com',
    baseUrl: undefined,
    apiKey: 'secret-key',
  };

  // The remedy has to reach the record that holds THIS project, exactly as
  // requireBaseUrl's does. Hardcoded to the mapping's own `--base-url` call, it named
  // a command the writer refuses for a committed or environment project — the one
  // message on this surface that did not use the shared writer.
  it.each([
    [
      'a committed project: the file edit, by path',
      {
        projectUrl: 'https://myproject.mysite.com',
        cwd: '/w/app',
        projectUrlSource: 'committed' as const,
        committedFilePath: '/w/app/formio.json',
      },
      /\/w\/app\/formio\.json/,
    ],
    [
      'an environment project: a call carrying BOTH halves',
      {
        projectUrl: 'https://myproject.mysite.com',
        cwd: '/w/app',
        projectUrlSource: 'environment' as const,
      },
      /--project-url https:\/\/myproject\.mysite\.com --base-url/,
    ],
    [
      'a mapped project: the mapping’s own update',
      {
        projectUrl: 'https://myproject.mysite.com',
        cwd: '/w/app',
        projectUrlSource: 'mapping' as const,
      },
      /set --base-url <base_url> --cwd \/w\/app/,
    ],
  ])('names the write that reaches the record — %s', async (_label, config, expected) => {
    await expect(
      gateRevisionsLicense(
        server,
        { ...config, apiKey: 'secret-key' },
        {
          actionLabel: 'publish',
          requiresRevisions: true,
          form: { title: 'Contact' },
        }
      )
    ).rejects.toThrow(expected);
  });

  // And never the mapping's command for a project held elsewhere, which is the shape
  // that was wrong.
  it('does not name the mapping-only command for a committed project', async () => {
    await expect(
      gateRevisionsLicense(
        server,
        {
          projectUrl: 'https://myproject.mysite.com',
          cwd: '/w/app',
          projectUrlSource: 'committed',
          committedFilePath: '/w/app/formio.json',
          apiKey: 'secret-key',
        },
        { actionLabel: 'publish', requiresRevisions: true, form: { title: 'Contact' } }
      )
    ).rejects.toThrow(/^(?!.*set --base-url <base_url>)/s);
  });

  it('demands the base URL when revisions are explicitly required', async () => {
    await expect(
      gateRevisionsLicense(server, unresolved, {
        actionLabel: 'publish',
        requiresRevisions: true,
        form: { title: 'Contact' },
      })
    ).rejects.toThrow(/Base URL/i);
  });

  // Stripping here would discard the user's setting on the strength of a probe
  // that never ran.
  it('demands the base URL rather than stripping a revisions setting', async () => {
    await expect(
      gateRevisionsLicense(server, unresolved, {
        actionLabel: 'create',
        requiresRevisions: false,
        form: { title: 'Contact', revisions: 'current' },
      })
    ).rejects.toThrow(/Base URL/i);
  });

  // Nothing is lost for a form that carries no revisions setting: stripping is a
  // no-op, so an API-key write proceeds untouched rather than failing over a
  // capability it never asked about.
  it('passes a form with no revisions setting through untouched', async () => {
    const form = { title: 'Contact', components: [] };

    const result = await gateRevisionsLicense(server, unresolved, {
      actionLabel: 'create',
      requiresRevisions: false,
      form,
    });

    expect(result.licensed).toBe(false);
    expect(result.form).toEqual(form);
  });

  // The license flag is read by an ANONYMOUS GET of ${baseUrl}/config.js, so this
  // demand has nothing to do with the JWT login. Reusing requireBaseUrl told an
  // API-key caller that JWT authentication was blocked and that "an API key needs
  // no Base URL and is unaffected" — in the one message only an API-key caller
  // with an underivable deployment ever reads.
  const rejectionMessage = async (form: Record<string, unknown>, requiresRevisions: boolean) => {
    try {
      await gateRevisionsLicense(server, unresolved, {
        actionLabel: 'create',
        requiresRevisions,
        form,
      });
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the gate to reject');
  };

  it('blames the license probe rather than JWT authentication', async () => {
    const message = await rejectionMessage({ title: 'Contact', revisions: 'current' }, false);

    expect(message).toMatch(/config\.js/);
    expect(message).not.toMatch(/JWT/i);
    expect(message).not.toMatch(/unaffected/i);
  });

  it('says an API key does not exempt this one', async () => {
    const message = await rejectionMessage({ title: 'Contact' }, true);

    expect(message).toMatch(/API key/i);
    expect(message).toMatch(/anonymous/i);
  });

  it('does not re-ask for the project URL, which is configured', async () => {
    const message = await rejectionMessage({ title: 'Contact' }, true);

    expect(message).toMatch(/--base-url|baseUrl/);
    expect(message).toMatch(/do not ask for the Project URL again/i);
  });

  it('does not claim the deployment is unlicensed by prompting for consent', async () => {
    await gateRevisionsLicense(server, unresolved, {
      actionLabel: 'create',
      requiresRevisions: false,
      form: { title: 'Contact' },
    });

    expect(mockConsent).not.toHaveBeenCalled();
  });
});
