// Every `Formio.<name>` and `Utils.<name>` an example reads exists on the real
// objects. `@formio/js` declares `Formio` as `any`, so only a runtime check can
// catch a static that does not exist — the `Formio.login` the pre-1.0 review
// found in formio-sdk.

import { describe, expect, it } from 'vitest';
import { memberProblems } from './member-problems.js';
import { skillExamples } from './skill-examples.js';

const example = (code: string) => ({
  doc: 'auth.md',
  index: 3,
  lang: 'ts' as const,
  line: 20,
  code,
  fragment: false,
});

describe('memberProblems', () => {
  it('reports a Formio static that does not exist', async () => {
    expect(await memberProblems([example("await Formio.login('a@b.c', 'pw');\n")])).toEqual([
      'auth.md example 3 (line 20): Formio has no login',
    ]);
  });

  it('reports a Utils member that does not exist', async () => {
    expect(await memberProblems([example('Utils.eachComponentDeep([], () => {});\n')])).toEqual([
      'auth.md example 3 (line 20): Utils has no eachComponentDeep',
    ]);
  });

  it('accepts real members, and ignores comments, strings, and instance members', async () => {
    const code = [
      "Formio.setBaseUrl('https://api.form.io');",
      '// Formio.login does not exist',
      "const label = 'Formio.login';",
      "const formio = new Formio('https://x.form.io/f');",
      'formio.loadForm();',
      'const sameName = obj.Formio.login;',
    ].join('\n');
    expect(await memberProblems([example(code)])).toEqual([]);
  });

  it('checks fragments too, since a member name needs no surrounding context', async () => {
    expect(
      await memberProblems([{ ...example('Formio.login();\n'), fragment: true }])
    ).toHaveLength(1);
  });
});

describe('skill examples read real Formio and Utils members', () => {
  it('every Formio and Utils member an example reads exists', async () => {
    expect(await memberProblems(skillExamples())).toEqual([]);
  });
});
