import { describe, expect, it } from 'vitest';
import {
  type Example,
  extractExamples,
  hasPlaceholder,
  isSelfContained,
  namedImports,
} from './extract.js';

const doc = (body: string) => body.replace(/^\n/, '');

describe('extractExamples', () => {
  it('extracts fenced js, ts and tsx blocks with their document, index and line', () => {
    const examples = extractExamples(
      'ref.md',
      doc(`
# Title

\`\`\`ts
const a = 1;
\`\`\`

\`\`\`json
{ "a": 1 }
\`\`\`

\`\`\`tsx
const b = <div />;
\`\`\`

\`\`\`javascript
const c = 3;
\`\`\`
`)
    );
    expect(examples.map((e) => [e.doc, e.index, e.lang, e.line])).toEqual([
      ['ref.md', 0, 'ts', 3],
      ['ref.md', 1, 'tsx', 11],
      ['ref.md', 2, 'js', 15],
    ]);
    expect(examples[0].code).toBe('const a = 1;\n');
  });

  it('marks a block preceded by the fragment marker, blank lines allowed between', () => {
    const [marked, plain] = extractExamples(
      'ref.md',
      doc(`
<!-- example: fragment -->

\`\`\`ts
form.submit();
\`\`\`

\`\`\`ts
form.submit();
\`\`\`
`)
    );
    expect(marked.fragment).toBe(true);
    expect(plain.fragment).toBe(false);
  });

  it('does not treat a marker separated by prose as applying to the block', () => {
    const [example] = extractExamples(
      'ref.md',
      doc(`
<!-- example: fragment -->
Some prose in between.

\`\`\`ts
form.submit();
\`\`\`
`)
    );
    expect(example.fragment).toBe(false);
  });
});

// CommonMark fences: backticks or tildes, at least three, indented up to three
// spaces — or nested under a list item, where the indentation is the item's. The
// closing fence is the same character, at least as long. Content lines lose the
// opening fence's indentation, so a nested example compiles like a top-level one.
describe('extractExamples fence forms', () => {
  it('extracts a tilde fence', () => {
    const [example] = extractExamples(
      'd.md',
      ['~~~ts', "import { Formio } from '@formio/js';", '~~~'].join('\n')
    );
    expect(example?.code).toBe("import { Formio } from '@formio/js';\n");
  });

  it('extracts a fence nested under a list item and strips its indentation', () => {
    const md = [
      '1. Step one:',
      '',
      '   ```ts',
      "   import { Formio } from '@formio/js';",
      '   Formio.setProjectUrl(url);',
      '   ```',
      '',
      '2. Step two.',
    ].join('\n');
    const [example] = extractExamples('d.md', md);
    expect(example?.lang).toBe('ts');
    expect(example?.line).toBe(3);
    expect(example?.code).toBe(
      "import { Formio } from '@formio/js';\nFormio.setProjectUrl(url);\n"
    );
  });

  it('extracts a fence nested deeper than three spaces under a bullet', () => {
    const md = ['- item', '    - nested', '      ```js', '      Formio.login();', '      ```'].join(
      '\n'
    );
    expect(extractExamples('d.md', md).map((e) => e.code)).toEqual(['Formio.login();\n']);
  });

  it('closes only on the same fence character at least as long', () => {
    const md = [
      '````ts',
      'const a = 1;',
      '```',
      'const b = 2;',
      '~~~~',
      'const c = 3;',
      '`````',
      'after',
    ].join('\n');
    const [example] = extractExamples('d.md', md);
    expect(example?.code).toBe('const a = 1;\n```\nconst b = 2;\n~~~~\nconst c = 3;\n');
  });

  it('honours the fragment marker above an indented fence', () => {
    const md = [
      '1. Step:',
      '',
      '   <!-- example: fragment -->',
      '   ```ts',
      '   form.submit();',
      '   ```',
    ].join('\n');
    expect(extractExamples('d.md', md)[0]?.fragment).toBe(true);
  });
});

describe('hasPlaceholder', () => {
  it.each([
    ['an ellipsis character', 'doThing(…);'],
    ['a bare spread placeholder before a brace', 'const o = { ... };'],
    ['a bare spread placeholder before a paren', 'call(...)'],
    ['a placeholder alone on a line', 'const a = 1;\n...\n'],
  ])('finds %s', (_label, code) => {
    expect(hasPlaceholder(code)).toBe(true);
  });

  it.each([
    ['spread of an identifier', 'const o = { ...rest, a: 1 };'],
    ['spread of a call', 'f(...args());'],
    ['an ellipsis in a line comment', 'const a = 1; // and so on ...'],
    ['an ellipsis in a block comment', '/* … */ const a = 1;'],
    ['an ellipsis in a string', "const s = 'Loading...';"],
  ])('ignores %s', (_label, code) => {
    expect(hasPlaceholder(code)).toBe(false);
  });
});

describe('namedImports', () => {
  it('collects named, aliased, type-only and multi-line imports', () => {
    const code = [
      "import { Formio, type FormioOptions as Opts } from '@formio/js';",
      'import {',
      '  Utils,',
      '  registerEvaluator,',
      "} from '@formio/js/utils';",
      'import type { Component } from "@formio/core";',
      "import React from 'react';",
      "import * as everything from '@formio/core';",
    ].join('\n');
    expect(namedImports(code)).toEqual([
      { module: '@formio/js', name: 'Formio' },
      { module: '@formio/js', name: 'FormioOptions' },
      { module: '@formio/js/utils', name: 'Utils' },
      { module: '@formio/js/utils', name: 'registerEvaluator' },
      { module: '@formio/core', name: 'Component' },
      { module: 'react', name: 'default' },
    ]);
  });
});

describe('isSelfContained', () => {
  const example = (lang: Example['lang'], code: string, fragment = false): Example => ({
    doc: 'ref.md',
    index: 0,
    lang,
    line: 1,
    code,
    fragment,
  });

  it('is a ts block that imports from a Form.io package with no placeholder', () => {
    expect(
      isSelfContained(
        example('ts', "import { Formio } from '@formio/js';\nFormio.setBaseUrl('x');")
      )
    ).toBe(true);
  });

  it('is not a block without a Form.io import, which leans on surrounding text', () => {
    expect(isSelfContained(example('ts', 'form.submit();'))).toBe(false);
  });

  it('is not a block with a placeholder', () => {
    expect(
      isSelfContained(example('ts', "import { Formio } from '@formio/js';\nFormio.createForm(…);"))
    ).toBe(false);
  });

  it('is not a marked fragment', () => {
    expect(isSelfContained(example('ts', "import { Formio } from '@formio/js';", true))).toBe(
      false
    );
  });

  it('is not a js or tsx block', () => {
    expect(isSelfContained(example('js', "import { Formio } from '@formio/js';"))).toBe(false);
  });
});
