// @ts-nocheck — loosely typed runtime instances; see rendering.test.ts.
// Behavior tests for plugin/skills/formio-form/references/wizards.md —
// wizard display mode, programmatic page navigation, conditional pages.

import { describe, expect, it, vi } from 'vitest';
import { conditionalWizardDefinition } from './fixtures/wizard-external';
import { createForm } from './renderer-harness';

describe('wizards.md — page navigation', () => {
  it('exposes programmatic next/previous page navigation', async () => {
    const wizard = await createForm(conditionalWizardDefinition);
    expect(wizard.pages.length).toBe(3);
    expect(wizard.page).toBe(0);

    await wizard.nextPage();
    expect(wizard.page).toBe(1);

    await wizard.prevPage();
    expect(wizard.page).toBe(0);
  });
});

describe('wizards.md — conditional pages', () => {
  it('drops a page whose condition is false', async () => {
    const wizard = await createForm(conditionalWizardDefinition);
    expect(wizard.pages.length).toBe(3);

    wizard.getComponent('wantsExtras').setValue('no');
    await vi.waitFor(() => {
      expect(wizard.pages.length).toBe(2);
    });

    wizard.getComponent('wantsExtras').setValue('yes');
    await vi.waitFor(() => {
      expect(wizard.pages.length).toBe(3);
    });
  });
});
