// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for
// plugin/skills/formio-form/references/calculated-values.md — a JSON Logic
// `calculateValue` deriving a total from quantity × price.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Formio } from '@formio/js';
import { calculatedFormDefinition } from './fixtures/logic';

const containers: HTMLElement[] = [];

function container(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  containers.push(el);
  return el;
}

afterEach(() => {
  for (const el of containers.splice(0)) {
    el.remove();
  }
});

describe('calculated-values.md — calculateValue with JSON Logic', () => {
  it('computes the total from quantity and price as inputs change', async () => {
    const form = await Formio.createForm(container(), calculatedFormDefinition);
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
