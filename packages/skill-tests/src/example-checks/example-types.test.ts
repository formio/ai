// Self-contained formio-sdk TypeScript examples compile against the installed
// @formio/js, counting only diagnostics that mean a wrong name: an undeclared
// name, a missing export, an unresolved Form.io module, or a member an imported
// binding does not have. The package's declarations get arity and assignability
// wrong in places (optional parameters typed as required, a mask array typed as
// a string), so those are not counted; and they type `Formio` itself as `any`,
// so its members are checked at runtime in example-members.test.ts.

import { describe, expect, it } from 'vitest';
import { isSelfContained } from './extract.js';
import { typeProblems } from './type-problems.js';
import { skillExamples } from './skill-examples.js';

const example = (code: string, index = 0) => ({
  doc: 'auth.md',
  index,
  lang: 'ts' as const,
  line: 10,
  code,
  fragment: false,
});

describe('typeProblems', () => {
  it('reports a member an imported binding does not have, naming the example', () => {
    const problems = typeProblems([
      example(
        "import { Utils } from '@formio/js/utils';\nUtils.eachComponentDeep([], () => {});\n"
      ),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^auth\.md example 0 \(line 10\):2: TS2\d+ .*eachComponentDeep/);
  });

  it('reports a name the example never declares, which marks it a fragment', () => {
    const problems = typeProblems([
      example(
        "import { Utils } from '@formio/js/utils';\nUtils.eachComponent(form.components, () => {});\n"
      ),
    ]);
    expect(problems).toEqual([expect.stringMatching(/TS2304 Cannot find name 'form'/)]);
  });

  it('reports an import the module does not export', () => {
    expect(typeProblems([example("import { Formio, login } from '@formio/js';\n")])).toEqual([
      expect.stringMatching(/TS2\d+ .*login/),
    ]);
  });

  it('does not report arity or assignability the declarations get wrong', () => {
    // getInputMask's second parameter is optional in the code but required in
    // the declarations, and matchInputMask takes the mask array it returns.
    const code =
      "import { Utils } from '@formio/js/utils';\nconst mask = Utils.getInputMask('(999) 999-9999');\nUtils.matchInputMask('(415) 555-1212', mask);\n";
    expect(typeProblems([example(code)])).toEqual([]);
  });

  it('accepts a correct example', () => {
    expect(
      typeProblems([
        example(
          "import { Formio } from '@formio/js';\nFormio.setBaseUrl('https://api.form.io');\n"
        ),
      ])
    ).toEqual([]);
  });

  it('compiles each example on its own', () => {
    const same =
      "import { Formio } from '@formio/js';\nconst url = 'https://api.form.io';\nFormio.setBaseUrl(url);\n";
    expect(typeProblems([example(same, 0), example(same, 1)])).toEqual([]);
  });
});

describe('formio-sdk examples type-check against @formio/js', () => {
  const examples = skillExamples(['formio-sdk']).filter(isSelfContained);

  it('has self-contained examples to check', () => {
    expect(examples.length).toBeGreaterThan(30);
  });

  it('every self-contained example compiles', () => {
    expect(typeProblems(examples)).toEqual([]);
  }, 120000);
});
