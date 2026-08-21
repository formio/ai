// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/external-data.md —
// fetching an external payload and setting it into the submission.
// fetch is stubbed; no live server involved.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { externalDataFormDefinition } from './fixtures/wizard-external';
import { createForm } from './renderer-harness';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('external-data.md — load external data into the submission', () => {
  it('populates the form from a fetched payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ firstName: 'Jane', lastName: 'Doe' }), {
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );

    const form = await createForm(externalDataFormDefinition);

    // The doc example: fetch the profile, then set it as the submission.
    const response = await fetch('https://api.example.com/profile/42');
    const profile = await response.json();
    await form.setSubmission({
      data: { firstName: profile.firstName, lastName: profile.lastName },
    });

    expect(form.submission.data.firstName).toBe('Jane');
    const firstName = form.getComponent('firstName');
    expect(firstName).toBeTruthy();
    expect(firstName.getValue()).toBe('Jane');
  });
});
