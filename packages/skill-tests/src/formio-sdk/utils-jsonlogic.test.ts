// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-jsonlogic.md`.

import { describe, expect, it } from 'vitest';
import { jsonLogic } from '@formio/core';

describe('utils-jsonlogic.md examples', () => {
  it('jsonLogic engine is exposed by @formio/core', () => {
    expect(jsonLogic).toBeTruthy();
    expect(typeof jsonLogic.apply).toBe('function');
    expect(typeof jsonLogic.add_operation).toBe('function');
    expect(typeof jsonLogic.rm_operation).toBe('function');
    expect(typeof jsonLogic.uses_data).toBe('function');
    expect(typeof jsonLogic.truthy).toBe('function');
  });

  it('Evaluate a simple rule', () => {
    const isAdult = jsonLogic.apply({ '>=': [{ var: 'data.age' }, 18] }, { data: { age: 21 } });
    expect(isAdult).toBe(true);
  });

  it('Compute a derived value', () => {
    const total = jsonLogic.apply(
      { '*': [{ var: 'data.qty' }, { var: 'data.unitPrice' }] },
      { data: { qty: 3, unitPrice: 19.99 } }
    );
    expect(total).toBeCloseTo(59.97, 2);
  });

  it('Combine conditions', () => {
    const eligible = jsonLogic.apply(
      {
        and: [
          { '==': [{ var: 'data.country' }, 'US'] },
          { '>=': [{ var: 'data.age' }, 21] },
          { '==': [{ var: 'data.consent' }, true] },
        ],
      },
      { data: { country: 'US', age: 25, consent: true } }
    );
    expect(eligible).toBe(true);
  });

  it('Form.io date helpers are registered (relativeMaxDate)', () => {
    const within30 = jsonLogic.apply(
      {
        '<=': [{ var: 'data.appointment' }, { relativeMaxDate: [30] }],
      },
      { data: { appointment: '2026-06-01T00:00:00.000Z' } }
    );
    expect(typeof within30).toBe('boolean');
  });

  it('Register a custom operator', () => {
    jsonLogic.add_operation(
      'startsWith',
      (str: unknown, prefix: unknown) =>
        typeof str === 'string' && typeof prefix === 'string' && str.startsWith(prefix)
    );

    try {
      const ok = jsonLogic.apply(
        { startsWith: [{ var: 'data.sku' }, 'ACME-'] },
        { data: { sku: 'ACME-1234' } }
      );
      expect(ok).toBe(true);
    } finally {
      jsonLogic.rm_operation('startsWith');
    }
  });

  it('Inspect dependencies before evaluating', () => {
    const rule = {
      and: [{ '==': [{ var: 'data.country' }, 'US'] }, { '>=': [{ var: 'data.age' }, 21] }],
    };
    const deps = jsonLogic.uses_data(rule).sort();
    expect(deps).toEqual(['data.age', 'data.country']);
  });
});
