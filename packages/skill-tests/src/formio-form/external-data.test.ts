// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/external-data.md —
// fetching an external payload and setting it into the submission.
// fetch is stubbed; no live server involved.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Structural: the reference states the runtime trust boundary for anything it
// fetches. The application fetches these URLs in the browser at runtime; the
// agent following this skill fetches none of them, and nothing fetched is
// trusted on arrival.

const externalDataDoc = readFileSync(
  join(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../..'),
    'plugin/skills/formio-form/references/external-data.md'
  ),
  'utf8'
);

describe('external-data.md states the trust boundary for fetched data', () => {
  const beforeFirstPattern = externalDataDoc.slice(
    0,
    externalDataDoc.indexOf('## Select with a URL data source')
  );

  it('says the application fetches at runtime and the agent fetches nothing during the task', () => {
    expect(beforeFirstPattern).toMatch(/at runtime/);
    expect(beforeFirstPattern).toMatch(/agent[^.]*(never|does not|not) fetch/i);
  });

  it('says responses are shape-validated before setSubmission', () => {
    expect(beforeFirstPattern).toMatch(/validat\w*[^.]*before[^.]*setSubmission/);
  });

  it('states the escaping direction correctly: {{ }} raw, {{{ }}} HTML-escaped', () => {
    // @formio/core Evaluator.ts: interpolate = {{ }}, escape = {{{ }}}.
    expect(beforeFirstPattern).toMatch(
      /`\{\{ \}\}` inserts the value raw and `\{\{\{ \}\}\}` HTML-escapes it/
    );
    expect(beforeFirstPattern).toMatch(/sanitizer whichever spelling/);
  });

  it('example hosts read as the application’s own API, not a generic third party', () => {
    expect(externalDataDoc).not.toContain('api.example.com');
    expect(externalDataDoc).not.toContain('example.com/api');
  });
});
