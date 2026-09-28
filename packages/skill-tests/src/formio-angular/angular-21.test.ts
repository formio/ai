// What an Angular 21 workspace — the newest major `@formio/angular` supports —
// actually does, and what the skill has to say so the app it generates builds,
// tests, and installs. Each block was reproduced against a real Angular 21
// `--no-standalone` workspace with `@formio/angular` 11.0.6 before it was written.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const angularRoot = join(repoRoot, 'plugin/skills/formio-angular');

const doc = (rel: string) => readFileSync(join(angularRoot, rel), 'utf8');

function everyMarkdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return everyMarkdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

// `@formio/angular`'s optional zone.js peer is `~0.14.0 || ~0.15.0`; Angular 21
// accepts 0.16, and installing into a workspace that has it fails with ERESOLVE.
describe('an installed zone.js outside the peer range is surfaced, not forced', () => {
  for (const [label, rel] of [
    ['BOOTSTRAP existing-workspace path', 'BOOTSTRAP.md'],
    ['embed branch', 'formio-angular-form/SKILL.md'],
  ] as const) {
    it(`${label} checks zone.js and offers ~0.15.0`, () => {
      const body = doc(rel);
      expect(body).toContain('ERESOLVE');
      expect(body).toContain('zone.js@~0.15.0');
      expect(body).toMatch(/never[^.]*`--legacy-peer-deps`[^.]*`--force`/i);
    });
  }
});

// npm `latest` for Angular runs ahead of `@formio/angular`'s peer range, and the
// embed branch installs into a workspace it did not scaffold.
describe('the embed branch checks the installed Angular against the peer range', () => {
  it('reads @angular/core and the peer range before installing', () => {
    const body = doc('formio-angular-form/SKILL.md');
    expect(body).toMatch(/npm view @formio\/angular peerDependencies/);
    expect(body).toMatch(/`@angular\/core`[^.]*outside[^.]*peer range/);
  });
});

// A production `ng build` of a Form.io app is ~2.1 MB initial; the CLI's default
// error budget is 1 MB, and a development-only smoke check never sees it.
describe('the production build fits its budget', () => {
  it('raises the initial budget and names the values', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toContain('"maximumError": "3MB"');
    expect(body).toContain('"maximumWarning": "2.5MB"');
  });

  it('allows the CommonJS dependencies the renderer brings', () => {
    expect(doc('BOOTSTRAP.md')).toContain(
      '"allowedCommonJsDependencies": ["@formio/js", "lodash"]'
    );
  });

  it('smoke-checks the production configuration as well as development', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toContain('ng build --configuration=development');
    expect(body).toMatch(/ng build --configuration=production/);
  });
});

// Angular 21's default test runner is Vitest through @angular/build:unit-test.
// Without these, any spec that reaches @formio/angular fails to load.
describe('ng test runs under the Vitest unit-test builder', () => {
  it('points the test target at a runner config that inlines @formio/angular', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toContain('"runnerConfig": "vitest.config.ts"');
    expect(body).toContain("inline: ['@formio/angular']");
    expect(body).toContain("Named export 'assign' not found");
  });

  it('stubs matchMedia, which jsdom lacks and @formio/js calls', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toContain('matchMedia is not a function');
    expect(body).toMatch(/Object\.defineProperty\(window, 'matchMedia'/);
  });
});

// NgIf / NgFor are deprecated since Angular 20. Built-in control flow works in
// NgModule components and needs no CommonModule import.
describe('generated templates use built-in control flow', () => {
  it('the design brief asks for @if / @for, not the structural directives', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toMatch(/built-in control flow \(`@if` \/ `@for` \/ `@switch`\)/);
    expect(body).not.toMatch(/\*ngIf` \/ `\*ngFor` \(NOT/);
  });

  it('no example in the skill family uses *ngIf or *ngFor', () => {
    const offenders = everyMarkdownUnder(angularRoot)
      .filter((path) => /\*ng(If|For)=/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(angularRoot, path));
    expect(offenders).toEqual([]);
  });
});

describe('the CLI fallback and Step 6 describe Angular 21 as it is', () => {
  it('scaffolds an NgModule workspace directly on the CLI fallback', () => {
    expect(doc('BOOTSTRAP.md')).toMatch(
      /@angular\/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR> new [^\n]*--no-standalone/
    );
  });

  it('does not claim Angular 21 generates provideZonelessChangeDetection or a polyfills array', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toContain('`provideZonelessChangeDetection()` if present');
    expect(body).not.toContain(
      'leave the `angular.json` `polyfills` array empty on both `build` and `test` targets'
    );
  });

  it('only repeats styles on a test target that has its own array', () => {
    for (const rel of ['BOOTSTRAP.md', 'formio-angular-form/references/styling.md']) {
      expect(doc(rel), rel).toMatch(/test` target[^.]*only (when|if) it has its own `styles`/);
    }
  });

  it('accepts the pre-Angular-20 module file names', () => {
    for (const rel of ['SKILL.md', 'BOOTSTRAP.md', 'formio-angular-resources/SKILL.md']) {
      expect(doc(rel), rel).toContain('app.module.ts');
    }
  });
});

describe('example versions match the current releases', () => {
  it('cites @formio/angular 11 and the measured stylesheet size', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).not.toMatch(/@formio\/angular@\^?10\./);
    expect(body).toContain('verified in `@formio/angular@11.0.6`');
    expect(body).toContain('~41 KB');
    expect(body).not.toContain('~44 KB');
  });
});

// eval-1 merges into this seed, so it is what an agent sees as "an existing
// Angular app". It tracks the major BOOTSTRAP targets and is a workspace that
// actually builds, not a pair of files importing components that do not exist.
describe('the eval seed is a buildable Angular 21 NgModule workspace', () => {
  const harness = join(repoRoot, 'packages/skill-tests/evals/formio-angular-resources');
  const seed = join(harness, 'fixtures/existing-workspace-seed');
  const read = (rel: string) => readFileSync(join(seed, rel), 'utf8');

  it('declares Angular 21 and no zone.js', () => {
    const { dependencies, devDependencies } = JSON.parse(read('package.json'));
    for (const name of ['@angular/core', '@angular/common', '@angular/router']) {
      expect(dependencies[name], name).toMatch(/^\^21\./);
    }
    expect(devDependencies['@angular/build']).toMatch(/^\^21\./);
    expect(dependencies['zone.js']).toBeUndefined();
  });

  it('uses the Angular 21 builders', () => {
    const { projects } = JSON.parse(read('angular.json'));
    const [project] = Object.values(projects) as {
      architect: Record<string, { builder: string }>;
    }[];
    expect(project.architect.build.builder).toBe('@angular/build:application');
    expect(project.architect.test.builder).toBe('@angular/build:unit-test');
  });

  it('carries every file its modules import', () => {
    for (const rel of [
      'src/main.ts',
      'src/index.html',
      'src/styles.scss',
      'src/app/app-module.ts',
      'src/app/app-routing-module.ts',
      'src/app/app.ts',
      'src/app/app.html',
      'src/app/home/home.component.ts',
      'tsconfig.json',
      'tsconfig.app.json',
    ]) {
      expect(() => read(rel), rel).not.toThrow();
    }
    expect(read('src/main.ts')).toContain('bootstrapModule(AppModule)');
    expect(read('src/app/app-routing-module.ts')).toContain('useHash: true');
  });

  it('the grader accepts both module file-name conventions', () => {
    const grader = readFileSync(join(harness, 'grade.py'), 'utf8');
    expect(grader).not.toMatch(/p\.name == "app-module\.ts"/);
    expect(grader).not.toMatch(/p\.name == "app-routing-module\.ts"/);
    expect(grader).toContain('"app.module.ts"');
    expect(grader).toContain('"app-routing.module.ts"');
  });
});
