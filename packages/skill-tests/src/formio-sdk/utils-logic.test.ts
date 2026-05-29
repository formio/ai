// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-logic.md`.

import { describe, expect, it } from 'vitest';
import { Utils } from '@formio/js/utils';
import { logicProcessSync, logicProcessInfo } from '@formio/core/process';

describe('utils-logic.md examples', () => {
  it('Check a single JavaScript trigger', () => {
    const component = {
      key: 'qty',
      type: 'number',
      input: true,
      logic: [],
    };

    const data = { qty: 50 };
    const fired = Utils.checkTrigger(
      component,
      { type: 'javascript', javascript: 'result = data.qty > 10;' },
      data,
      data,
      { components: [component] },
      null
    );
    expect(fired).toBe(true);
  });

  it('Apply a "set hidden when approved" rule via logicProcessSync', () => {
    const component = {
      key: 'managerApproval',
      type: 'textfield',
      input: true,
      hidden: false,
      logic: [
        {
          name: 'hide once approved',
          trigger: {
            type: 'javascript',
            javascript: 'result = data.status === "approved";',
          },
          actions: [
            {
              type: 'property',
              property: {
                type: 'boolean',
                label: 'Hidden',
                value: 'hidden',
                component: 'hidden',
              },
              state: true,
            },
          ],
        },
      ],
    };

    const data = { status: 'approved' };
    logicProcessSync({
      component,
      data,
      row: data,
      form: { components: [component] },
      path: 'managerApproval',
      scope: {},
    });

    expect(component.hidden).toBe(true);
  });

  it('Compute a derived value via a value action', () => {
    const component = {
      key: 'total',
      type: 'number',
      input: true,
      logic: [
        {
          name: 'sum',
          trigger: { type: 'javascript', javascript: 'result = true;' },
          actions: [{ type: 'value', value: 'value = data.qty * data.unitPrice;' }],
        },
      ],
    };

    const data: Record<string, number> = { qty: 3, unitPrice: 19.99 };
    logicProcessSync({
      component,
      data,
      row: data,
      form: { components: [component] },
      path: 'total',
      scope: {},
    });

    expect(data.total).toBeCloseTo(59.97, 2);
  });

  it('Run logic for every component in a form (hasLogic guard via logicProcessInfo.shouldProcess)', () => {
    const totalComponent = {
      key: 'total',
      type: 'number',
      input: true,
      logic: [
        {
          name: 'sum',
          trigger: { type: 'javascript', javascript: 'result = true;' },
          actions: [{ type: 'value', value: 'value = data.qty + 1;' }],
        },
      ],
    };
    const noLogicComponent = { key: 'qty', type: 'number', input: true };
    const form = { components: [noLogicComponent, totalComponent] };
    const data: Record<string, number> = { qty: 5 };

    for (const component of form.components) {
      if (!logicProcessInfo.shouldProcess({ component })) continue;
      logicProcessSync({
        component,
        data,
        row: data,
        form,
        path: component.key,
        scope: {},
      });
    }

    expect(data.total).toBe(6);
  });
});
