// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/conditionals.md —
// simple (`show`/`when`/`eq`) and JSON Logic (`conditional.json`) visibility.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Formio } from '@formio/js';
import { jsonConditionalFormDefinition, simpleConditionalFormDefinition } from './fixtures/logic';

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

describe('conditionals.md — conditional.json', () => {
  it('hides the dependent component until the driver value matches', async () => {
    const form = await Formio.createForm(container(), jsonConditionalFormDefinition);
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
    const form = await Formio.createForm(container(), simpleConditionalFormDefinition);
    const employer = form.getComponent('employer');
    expect(employer).toBeTruthy();
    expect(employer.visible).toBe(false);

    form.getComponent('employed').setValue('yes');
    await vi.waitFor(() => {
      expect(form.getComponent('employer').visible).toBe(true);
    });
  });
});
