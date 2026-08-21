// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/validation.md —
// the canonical `validate.json` contract: JSON Logic evaluating to `true`
// means valid, evaluating to a string makes that string the error message.

import { describe, expect, it } from 'vitest';
import { validationFormDefinition } from './fixtures/logic';
import { createForm } from './renderer-harness';

describe('validation.md — validate.json', () => {
  it('surfaces the JSON Logic error string for an invalid value', async () => {
    const form = await createForm(validationFormDefinition);
    await form.setSubmission({ data: { name: 'Alice' } });
    await expect(form.submit()).rejects.toBeTruthy();
    const messages = form.errors.map((error) => error.message ?? String(error));
    expect(messages.join('\n')).toContain("Your name must be 'Bob'!");
  });

  it('accepts the valid value and clears the error', async () => {
    const form = await createForm(validationFormDefinition);
    const nameComponent = form.getComponent('name');
    expect(nameComponent).toBeTruthy();
    await form.setSubmission({ data: { name: 'Bob' } });
    const submission = await form.submit();
    expect(submission.data.name).toBe('Bob');
    expect(form.errors).toHaveLength(0);
  });
});
