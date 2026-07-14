// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/field-logic.md —
// a component `logic` entry with a `json` trigger applying a property action.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Formio } from '@formio/js';
import { fieldLogicFormDefinition } from './fixtures/logic';

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

describe('field-logic.md — json trigger with a property action', () => {
  it('disables the component while the trigger evaluates true', async () => {
    const form = await Formio.createForm(container(), fieldLogicFormDefinition);
    const notes = form.getComponent('notes');
    expect(notes).toBeTruthy();
    expect(notes.disabled).toBeFalsy();

    form.getComponent('status').setValue('locked');
    await vi.waitFor(() => {
      expect(form.getComponent('notes').disabled).toBe(true);
    });
  });
});
