// A version written into a skill as a fact rots: the registry moves and the skill
// keeps telling the agent the old number. Where a step depends on a version, the
// step reads it with `npm view` and acts on what it gets; where prose only
// illustrates one, it names the resolved value. Version boundaries ("from
// Angular 21 on") stay true as releases move, so they may remain.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const skills = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../plugin/skills');
const read = (path: string): string => readFileSync(join(skills, path), 'utf8');

function markdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

describe('formio-react reads versions at run time', () => {
  it('BOOTSTRAP reads react-router engines and peers instead of stating them', () => {
    const text = read('formio-react/BOOTSTRAP.md');
    expect(text).toMatch(/npm view react-router engines/);
    expect(text).toMatch(/npm view react-router peerDependencies/);
    expect(text).not.toMatch(/22\.22|19\.2\.7/);
    expect(text).not.toMatch(/~73 /);
  });

  it('EXISTING reads the router major requirements instead of stating them', () => {
    const text = read('formio-react/EXISTING.md');
    expect(text).toMatch(/npm view react-router/);
    expect(text).not.toMatch(/22\.22|19\.2\.7/);
  });

  it('environments.md picks the plugin-react major from its Vite peer', () => {
    const text = read('formio-react/formio-react-form/references/environments.md');
    expect(text).toMatch(/npm view @vitejs\/plugin-react[^\n]*peerDependencies/);
    expect(text).not.toMatch(/@vitejs\/plugin-react@\^\d/);
    expect(text).not.toMatch(/add -D @vitejs\/plugin-react\s*$/m);
  });
});

describe('formio-angular reads versions at run time', () => {
  const angular = join(skills, 'formio-angular');

  it.each(['formio-angular/BOOTSTRAP.md', 'formio-angular/formio-angular-form/SKILL.md'])(
    '%s reads the zone.js peer instead of stating a range',
    (path) => {
      const text = read(path);
      expect(text).toMatch(/npm view zone\.js@/);
      expect(text).not.toMatch(/~0\.1[456]\.0/);
      expect(text).not.toContain('zone.js@~0.15.0');
    }
  );

  it('every "Angular 21" is a version boundary, not the target', () => {
    const offenders = markdownUnder(angular).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line) =>
          [...line.matchAll(/Angular 21\b/g)]
            .filter((m) => {
              const around = line.slice(Math.max(0, m.index - 12), m.index + 26);
              return !/[Ff]rom Angular 21 on|Angular 21 (and|or) later/.test(around);
            })
            .map(() => `${relative(skills, path)}: ${line.slice(0, 80)}`)
        )
    );
    expect(offenders).toEqual([]);
  });

  it('no stylesheet or bundle size, and no example release, is stated as fact', () => {
    const text = markdownUnder(angular)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/~41 KB|2\.1 MB|480 KB/);
    expect(text).not.toMatch(/\b11\.0\.6\b|\b5\.6\.1\b|\b5\.3\.8\b|\b1\.13\.1\b/);
  });
});
