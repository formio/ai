// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/field-logic.md —
// a component `logic` entry with a `json` trigger applying a property action.

import { describe, expect, it, vi } from 'vitest';
import { fieldLogicFormDefinition } from './fixtures/logic';
import { createForm } from './renderer-harness';

describe('field-logic.md — json trigger with a property action', () => {
  it('disables the component while the trigger evaluates true', async () => {
    const form = await createForm(fieldLogicFormDefinition);
    const notes = form.getComponent('notes');
    expect(notes).toBeTruthy();
    expect(notes.disabled).toBeFalsy();

    form.getComponent('status').setValue('locked');
    await vi.waitFor(() => {
      expect(form.getComponent('notes').disabled).toBe(true);
    });
  });
});
