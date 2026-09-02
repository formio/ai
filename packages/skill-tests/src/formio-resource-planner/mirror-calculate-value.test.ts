// The transitive group-access mirror's `calculateValue` is copied literally by
// agents out of these docs, so the exact expression is load-bearing. Both halves
// of the guard were verified against the renderer source:
//
//   formio.js/src/components/_classes/component/Component.js  doValueCalculation
//     Evaluates the expression with `value` SEEDED to the component's current
//     dataValue. That is what makes `|| value` a real fallback rather than a
//     no-op.
//
//   formio.js/src/components/_classes/component/Component.js  calculateComponentValue
//     `if (_.isNil(calculatedValue)) { calculatedValue = this.emptyValue; }`
//     A nil result does NOT leave the field untouched — it CLEARS it. On a group
//     mirror that means saving a row with no group reference, so the server
//     stamps no ACL from it and every member of that group loses the record.
//
// Therefore:
//   `data.<parent>.data.<group>`        -> TypeError on every unresolved parent
//   `data.<parent>?.data?.<group>`      -> no throw, but silently strips access
//   `data.<parent>?.data?.<group> || value`  -> correct
//
// This test exists because the unguarded form shipped once and produced
// "An error occured within custom function for team" on every child screen.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return allFiles(full);
    return statSync(full).isFile() ? [full] : [];
  });
}

const documented = allFiles(skillsRoot).filter((p) => /\.(md|json)$/.test(p));

/** `value = data.<parent>.data.<group>` with no optional chaining. */
const UNGUARDED = /value\s*=\s*data\.[A-Za-z0-9_]+\.data\./;
/** Any mirror expression, guarded or not. */
const ANY_MIRROR = /value\s*=\s*data\.[A-Za-z0-9_]+\??\.data\??\./;

describe('transitive group-access mirror — calculateValue guard', () => {
  it('no skill document shows the unguarded expression', () => {
    const offenders = documented
      .filter((p) => UNGUARDED.test(readFileSync(p, 'utf8')))
      .map((p) => relative(repoRoot, p));
    expect(offenders).toEqual([]);
  });

  it('every mirror expression falls back to `|| value`', () => {
    const offenders: string[] = [];
    for (const path of documented) {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!ANY_MIRROR.test(line)) continue;
        if (!/\|\|\s*value/.test(line))
          offenders.push(`${relative(repoRoot, path)}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the checked-in transitive example uses the guarded form', () => {
    const example = readFileSync(
      join(
        skillsRoot,
        'formio-resource-planner/references/examples/complex-crm-transitive/template.json'
      ),
      'utf8'
    );
    expect(example).toContain('value = data.account?.data?.team || value;');
    expect(example).not.toContain('value = data.account.data.team;');
  });

  it('template-json.md explains why each half of the guard is required', () => {
    const body = readFileSync(
      join(skillsRoot, 'formio-resource-planner/references/template-json.md'),
      'utf8'
    );
    expect(body).toContain('emptyValue');
    expect(body.toLowerCase()).toMatch(/cannot read properties of undefined/);
  });
});
