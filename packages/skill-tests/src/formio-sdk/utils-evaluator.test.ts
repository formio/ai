// @ts-nocheck — these tests deliberately exercise the runtime surface of
// `@formio/js/utils` exactly as documented in the skill references, even
// where the published `.d.ts` declarations are stricter or out of sync with
// the runtime. The goal is to detect doc-vs-runtime drift; TypeScript types
// are the wrong oracle for that.
//
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-evaluator.md` and asserts that
// the documented behavior matches what `@formio/js/utils` actually exposes at
// runtime. Tests are deliberately one-shot — if `@formio/js` changes its
// Utils surface, these tests reveal the drift so the reference doc can be
// updated.

import { describe, expect, it } from 'vitest';
import { Utils, registerEvaluator, DefaultEvaluator } from '@formio/js/utils';

describe('utils-evaluator.md examples', () => {
  it('Interpolate a template string', () => {
    const greeting = Utils.Evaluator.interpolateString('Hello {{ data.firstName }}!', {
      data: { firstName: 'Alice' },
    });
    expect(greeting).toBe('Hello Alice!');
  });

  it('Evaluate a custom validation expression', () => {
    const valid = Utils.Evaluator.evaluate(
      'valid = data.age >= 18;',
      { data: { age: 21 } },
      'valid'
    );
    expect(valid).toBe(true);
  });

  it('Evaluate a JSONLogic expression', () => {
    const ok = Utils.Evaluator.evaluate({ '>=': [{ var: 'data.age' }, 18] }, { data: { age: 21 } });
    expect(ok).toBe(true);
  });

  it('Compile and reuse a function', () => {
    const fn = Utils.Evaluator.evaluator('return data.first + " " + data.last;', 'data');
    expect(typeof fn).toBe('function');
    expect(fn({ first: 'Ada', last: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('interpolateString does NOT HTML-escape; pair with sanitize for safe HTML output', () => {
    const raw = Utils.Evaluator.interpolateString('<p>Hello {{ data.firstName }}</p>', {
      data: { firstName: '<img src=x onerror=alert(1)>' },
    });
    // interpolateString substitutes verbatim — the raw output is dangerous.
    expect(raw).toContain('<img');
    expect(raw.toLowerCase()).toContain('onerror');

    const safe = Utils.sanitize(raw, {}).toString();
    // sanitize strips the onerror handler (and any other DOMPurify-unsafe attrs).
    expect(safe.toLowerCase()).not.toContain('onerror');
    expect(safe).toContain('<p>Hello');
  });

  it('registerEvaluator + DefaultEvaluator are top-level exports usable to install a sandboxed evaluator', () => {
    // Doc notes that under ESM-import semantics the swap does not retroactively
    // rebind references that consumer code already holds (including
    // `Utils.Evaluator`) — only SDK-internal evaluations see the override.
    // The exposed surface is what we verify here.
    expect(typeof registerEvaluator).toBe('function');
    expect(typeof DefaultEvaluator).toBe('function');

    class Sandboxed extends DefaultEvaluator {}
    expect(() => registerEvaluator(new Sandboxed({ noeval: true }))).not.toThrow();
    // Restore default so other tests are not affected.
    registerEvaluator(new DefaultEvaluator());
  });

  it('module-level convenience: Utils.interpolate delegates to Evaluator.interpolate', () => {
    expect(typeof Utils.interpolate).toBe('function');
    const out = Utils.interpolate('{{ data.x }}', { data: { x: 7 } });
    expect(out).toBe('7');
  });

  it('module-level convenience: Utils.evaluate delegates to Evaluator.evaluate', () => {
    expect(typeof Utils.evaluate).toBe('function');
    const result = Utils.evaluate('value = data.a + data.b;', { data: { a: 2, b: 3 } }, 'value');
    expect(result).toBe(5);
  });
});
