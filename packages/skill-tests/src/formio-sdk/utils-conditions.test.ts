// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-conditions.md`.

import { describe, expect, it } from 'vitest';
import { Utils } from '@formio/js/utils';

describe('utils-conditions.md examples', () => {
  it('Evaluate a simple conditional', () => {
    const conditional = {
      conjunction: 'all',
      conditions: [
        { component: 'subscribe', operator: 'isEqual', value: true },
        { component: 'region', operator: 'isEqual', value: 'EU' },
      ],
      show: true,
    };

    const data = { subscribe: true, region: 'EU' };
    const visible = Utils.checkSimpleConditional({}, conditional, data, data, null);
    expect(visible).toBe(true);
  });

  it('Evaluate a JSONLogic conditional', () => {
    const json = { '>': [{ var: 'data.age' }, 17] };
    const data = { age: 21 };
    const eligible = Utils.checkJsonConditional({}, json, data, data, null, false);
    expect(eligible).toBe(true);
  });

  it('Evaluate a custom JavaScript conditional', () => {
    const data = { kind: 'premium', seats: 3 };
    const visible = Utils.checkCustomConditional(
      {},
      'show = data.kind === "premium" && data.seats > 0;',
      data,
      data,
      null,
      'show',
      false
    );
    expect(visible).toBe(true);
  });

  it('Evaluate via the high-level helper', () => {
    const form = {
      components: [
        {
          type: 'textfield',
          key: 'discount',
          input: true,
          conditional: {
            json: { '>': [{ var: 'data.total' }, 100] },
          },
        },
      ],
    };
    const submission = { data: { total: 250 } };

    const results: Record<string, unknown> = {};
    Utils.eachComponent(form.components, (component) => {
      if (!component.conditional) return;
      results[component.key] = Utils.checkCondition(
        component,
        submission.data,
        submission.data,
        form,
        null
      );
    });
    expect(results.discount).toBe(true);
  });

  it('Handle a legacy when / eq / show conditional via checkSimpleConditional', () => {
    const data = { country: 'US' };
    const visible = Utils.checkSimpleConditional(
      {},
      { when: 'country', eq: 'US', show: 'true' },
      data,
      data,
      null
    );
    expect(visible).toBe(true);
  });
});
