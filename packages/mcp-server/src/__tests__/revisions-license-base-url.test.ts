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

  it('does not claim the deployment is unlicensed by prompting for consent', async () => {
    await gateRevisionsLicense(server, unresolved, {
      actionLabel: 'create',
      requiresRevisions: false,
      form: { title: 'Contact' },
    });

    expect(mockConsent).not.toHaveBeenCalled();
  });
});
