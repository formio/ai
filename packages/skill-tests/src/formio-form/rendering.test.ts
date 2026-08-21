// @ts-nocheck — the runtime form/component instances returned by
// `Formio.createForm` are loosely typed in @formio/js; see
// formio-sdk/utils-evaluator.test.ts for the convention.
// Behavior tests for the examples in
// plugin/skills/formio-form/references/rendering.md, javascript-api.md, and
// options.md — run against the real @formio/js renderer in jsdom.

import { describe, expect, it } from 'vitest';
import { contactFormDefinition, prefillSubmission } from './fixtures/rendering';
import { createForm } from './renderer-harness';

describe('rendering.md — Formio.createForm with inline JSON', () => {
  it('resolves to a form instance exposing the documented components', async () => {
    const form = await createForm(contactFormDefinition);
    expect(form).toBeTruthy();
    expect(form.getComponent('firstName')).toBeTruthy();
    expect(form.getComponent('lastName')).toBeTruthy();
  });
});

describe('rendering.md — submission pre-fill', () => {
  it('round-trips pre-filled data through form.submission', async () => {
    const form = await createForm(contactFormDefinition);
    await form.setSubmission(prefillSubmission);
    expect(form.submission.data.firstName).toBe('Jane');
    const firstName = form.getComponent('firstName');
    expect(firstName).toBeTruthy();
    expect(firstName.getValue()).toBe('Jane');
  });
});

describe('javascript-api.md — events', () => {
  it('emits change when a component value is set', async () => {
    const form = await createForm(contactFormDefinition);
    const changed = new Promise((resolve) => {
      form.on('change', resolve);
    });
    const firstName = form.getComponent('firstName');
    expect(firstName).toBeTruthy();
    firstName.setValue('Jane');
    await changed;
    expect(form.submission.data.firstName).toBe('Jane');
  });

  it('delivers the submission to the submit handler', async () => {
    const form = await createForm(contactFormDefinition);
    await form.setSubmission(prefillSubmission);
    const submitted = new Promise((resolve) => {
      form.on('submit', resolve);
    });
    form.submit();
    const submission = await submitted;
    expect(submission.data.firstName).toBe('Jane');
  });
});

describe('options.md — renderer options', () => {
  it('readOnly: true renders a non-editable form', async () => {
    const form = await createForm(contactFormDefinition, {
      readOnly: true,
    });
    expect(form.options.readOnly).toBe(true);
    const firstName = form.getComponent('firstName');
    expect(firstName).toBeTruthy();
    expect(firstName.disabled || firstName.options.readOnly).toBe(true);
  });
});
