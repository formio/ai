// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/conditionals.md —
// simple (`show`/`when`/`eq`) and JSON Logic (`conditional.json`) visibility.

import { describe, expect, it, vi } from 'vitest';
import { jsonConditionalFormDefinition, simpleConditionalFormDefinition } from './fixtures/logic';
import { createForm } from './renderer-harness';

describe('conditionals.md — conditional.json', () => {
  it('hides the dependent component until the driver value matches', async () => {
    const form = await createForm(jsonConditionalFormDefinition);
    const employer = form.getComponent('employer');
    expect(employer).toBeTruthy();
    expect(employer.visible).toBe(false);

    form.getComponent('employed').setValue('yes');
    await vi.waitFor(() => {
      expect(form.getComponent('employer').visible).toBe(true);
    });

    form.getComponent('employed').setValue('no');
    await vi.waitFor(() => {
      expect(form.getComponent('employer').visible).toBe(false);
    });
  });
});

describe('conditionals.md — simple show/when/eq', () => {
  it('behaves the same as the JSON Logic form', async () => {
    const form = await createForm(simpleConditionalFormDefinition);
    const employer = form.getComponent('employer');
    expect(employer).toBeTruthy();
    expect(employer.visible).toBe(false);

    form.getComponent('employed').setValue('yes');
    await vi.waitFor(() => {
      expect(form.getComponent('employer').visible).toBe(true);
    });
  });
});
