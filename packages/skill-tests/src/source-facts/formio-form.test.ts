// What formio-form tells an agent about the submit sequence, renderer options and
// imports, checked against @formio/js's Webform (packages/formio.js/src/Webform.js):
// for a URL-backed form `submit` fires after the server save, so work that must
// precede the save belongs in `hooks.beforeSubmit`.

import { describe, expect, it } from 'vitest';
import { section, skillReader } from './skill-text.js';

const read = skillReader('formio-form');

describe('javascript-api.md: the submit sequence', () => {
  const doc = read('references/javascript-api.md');
  const row = (event: string) =>
    doc.split('\n').find((l) => l.startsWith(`| \`${event}\` |`)) ?? '';

  it('the submit row says it fires after the server save for a URL-backed form', () => {
    expect(row('submit')).toMatch(/after the server (has )?saved/);
    expect(row('submit')).not.toMatch(/the user submits and validation passes \|/);
  });

  it('names hooks.beforeSubmit for work that must precede the save', () => {
    expect(doc).toMatch(/hooks\.beforeSubmit/);
  });

  it('the programmatic submit text saves before emitting submit', () => {
    const text = section(doc, '## Submitting programmatically');
    expect(text).not.toMatch(/emits `submit`, and — for URL-backed forms — saves/);
    expect(text).toMatch(/saves to the server[^.]*then emits `submit`/);
  });
});

describe('options.md: the combined example keeps the default sanitizer', () => {
  const doc = read('references/options.md');

  it('the combined example does not set sanitizeConfig', () => {
    expect(section(doc, '## Combined example')).not.toContain('sanitizeConfig');
  });

  it('a separately labelled opt-in snippet allows iframes', () => {
    const optIn = section(doc, '## Opt-in: allow embedded iframes');
    expect(optIn).toContain("addTags: ['iframe']");
    expect(optIn).toMatch(/Add this only/);
  });
});

describe('setup.md: imports and CDN pins', () => {
  const doc = read('references/setup.md');

  it('has no blanket ban on @formio/core and defers to formio-sdk for the helpers', () => {
    expect(doc).not.toMatch(/Never import from `@formio\/core`/);
    expect(doc).toMatch(/formio-sdk/);
  });

  it('every @formio/js version agrees with the pinned one or is a `<…>` slot', () => {
    const versions = [...doc.matchAll(/@formio\/js@([^/\s`]+)/g)].map((m) => m[1]);
    const pinned = versions.filter((v) => !v.startsWith('<'));
    expect(new Set(pinned).size).toBeLessThanOrEqual(1);
    expect(doc).not.toContain('@5.5.1');
  });
});
