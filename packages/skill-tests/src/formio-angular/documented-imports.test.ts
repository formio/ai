// Every symbol the Angular skill tells an agent to import from `@formio/js`
// must actually be exported by `@formio/js`.
//
// A code review caught the case this exists for: `renderer-directly.md`'s only
// complete scaffold opened with
//
//   import type { Webform, Submission } from '@formio/js';
//
// and `Submission` is not exported there — it lives in `@formio/core/types`,
// which is what `@formio/angular`'s own components import. `tsc` reports
// TS2305, so every agent copying that scaffold started with a build error.
// Prose review does not catch this; the package does.
//
// Scope note: this checks `@formio/js` only. `@formio/angular` is not a
// dependency of this repo, so the Angular component's own input/output surface
// cannot be verified here and stays a prose-accuracy concern.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as FormioJs from '@formio/js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const angularRoot = join(repoRoot, 'plugin/skills/formio-angular');

function everyMarkdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return everyMarkdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

interface DocumentedImport {
  doc: string;
  symbol: string;
}

// `import { A, B } from '@formio/js';` and its `import type` form. Default and
// namespace imports are out of scope — the library documents neither.
const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'@formio\/js'/g;

function documentedImports(): DocumentedImport[] {
  return everyMarkdownUnder(angularRoot).flatMap((path) => {
    const body = readFileSync(path, 'utf8');
    return [...body.matchAll(NAMED_IMPORT)].flatMap((match) =>
      match[1]
        .split(',')
        .map((name) =>
          name
            .trim()
            .split(/\s+as\s+/)[0]
            .trim()
        )
        .filter(Boolean)
        .map((symbol) => ({ doc: relative(angularRoot, path), symbol }))
    );
  });
}

describe('symbols the Angular skill imports from @formio/js', () => {
  it('finds import statements to check', () => {
    expect(documentedImports().length).toBeGreaterThan(0);
  });

  it('are all real exports of the installed @formio/js', () => {
    const exported = new Set(Object.keys(FormioJs));
    const offenders = documentedImports()
      .filter(({ symbol }) => !exported.has(symbol))
      .map(({ doc, symbol }) => `${doc}: ${symbol}`);

    expect(
      offenders,
      'a documented import names something @formio/js does not export — the snippet will not compile'
    ).toEqual([]);
  });

  // The specific miss, pinned so a well-meaning edit does not reintroduce it.
  it('never imports Submission from @formio/js', () => {
    expect(Object.keys(FormioJs)).not.toContain('Submission');
    const offenders = documentedImports()
      .filter(({ symbol }) => symbol === 'Submission')
      .map(({ doc }) => doc);
    expect(offenders, 'Submission is exported by @formio/core/types, not @formio/js').toEqual([]);
  });
});
