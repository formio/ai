// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for
// plugin/skills/formio-form/references/calculated-values.md — a JSON Logic
// `calculateValue` deriving a total from quantity × price.

import { describe, expect, it, vi } from 'vitest';
import { calculatedFormDefinition } from './fixtures/logic';
import { createForm } from './renderer-harness';

describe('calculated-values.md — calculateValue with JSON Logic', () => {
  it('computes the total from quantity and price as inputs change', async () => {
    const form = await createForm(calculatedFormDefinition);
    expect(form.getComponent('total')).toBeTruthy();

    form.getComponent('quantity').setValue(3);
    form.getComponent('price').setValue(2.5);
    await vi.waitFor(() => {
      expect(form.submission.data.total).toBe(7.5);
    });

    form.getComponent('quantity').setValue(4);
    await vi.waitFor(() => {
      expect(form.submission.data.total).toBe(10);
    });
  });
});
