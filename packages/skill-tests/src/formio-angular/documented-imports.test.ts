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

import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

/** Runtime exports plus whatever the shipped type declarations re-export. */
function exportedNames(): Set<string> {
  const names = new Set(Object.keys(FormioJs));
  const entry = createRequire(import.meta.url).resolve('@formio/js');
  const declaration = join(dirname(entry), 'index.d.ts');
  if (!existsSync(declaration)) {
    return names;
  }
  const body = readFileSync(declaration, 'utf8');
  for (const match of body.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const raw of match[1].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

describe('symbols the Angular skill imports from @formio/js', () => {
  it('finds import statements to check', () => {
    expect(documentedImports().length).toBeGreaterThan(0);
  });

  // Runtime keys alone are not the whole surface: a `import type { X }` of a
  // genuinely type-only export would be correct TypeScript and invisible to
  // Object.keys. So the check is the union of the runtime keys and the names the
  // shipped .d.ts re-exports. (As of @formio/js 5.3.6 the two happen to coincide
  // — `FormOptions` is exported as a runtime `undefined` for type resolution —
  // but relying on that would make a future type-only export a false positive.)
  it('are all real exports of the installed @formio/js', () => {
    const offenders = documentedImports()
      .filter(({ symbol }) => !exportedNames().has(symbol))
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

// Two review rounds caught the same shape: a TypeScript example referencing a
// member it never declares. `renderer-directly.md`'s scaffold used
// `this.formUrl` with no field, no `@Input()`, no `inject()` — `TS2339` for
// anyone who copied it. The import guard above cannot see it, because the
// defect is in the class body rather than the import line.
//
// The rule is per DOCUMENT, not per fence: examples legitimately compose across
// snippets (a scaffold above, a method defined in a later section). What must
// not happen is a `this.x` whose `x` is declared nowhere in the document at all.
describe('TypeScript examples declare the members they use', () => {
  const TS_FENCE = /```ts\n([\s\S]*?)```/g;

  // Anything that reads as a declaration of `name`: a field, a method, a
  // constructor parameter property, or a decorated member.
  const DECLARES =
    /(?:^|\n)\s*(?:@\w+\([^)]*\)\s*)?(?:(?:private|public|protected|readonly|static|async|get|set)\s+)*([A-Za-z_]\w*)\s*[(!?:=]/g;

  function tsBodies(body: string): string {
    return [...body.matchAll(TS_FENCE)].map((match) => match[1]).join('\n');
  }

  it('no example references a `this.` member the document never declares', () => {
    const offenders: string[] = [];

    for (const path of everyMarkdownUnder(angularRoot)) {
      const code = tsBodies(readFileSync(path, 'utf8'));
      if (!code.includes('this.')) continue;

      const declared = new Set([...code.matchAll(DECLARES)].map((match) => match[1]));
      const used = new Set([...code.matchAll(/\bthis\.([A-Za-z_]\w*)/g)].map((m) => m[1]));

      for (const name of used) {
        if (!declared.has(name)) {
          offenders.push(`${relative(angularRoot, path)}: this.${name}`);
        }
      }
    }

    expect(
      offenders,
      'a documented example uses a member nothing in that document declares — it will not compile'
    ).toEqual([]);
  });
});
