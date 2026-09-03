// `plugin/` is copied into a consumer's project by `npx skills add formio/ai`,
// so eval harnesses — graders, benchmark fixtures, and the runbooks for using
// them — have no business living under it. They belong to maintainers of this
// library, not users of it.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const at = (...parts: string[]) => join(repoRoot, ...parts);
const harness = (...parts: string[]) => at('packages/skill-tests/evals', ...parts);

const NEW_ROOT = 'packages/skill-tests/evals';

const HARNESSES = [
  'formio-resource-planner',
  'formio-angular-resources',
  'formio-react-resources',
] as const;

const RETIRED_LOCATIONS = [
  'plugin/skills/formio-resource-planner/evals',
  'plugin/skills/formio-angular/formio-angular-resources/evals',
] as const;

describe('eval harnesses live outside the shipped tree', () => {
  it.each(HARNESSES)('evals/%s carries the harness', (skill) => {
    for (const file of ['evals.json', 'grade.py', 'README.md']) {
      expect(existsSync(harness(skill, file)), `${NEW_ROOT}/${skill}/${file}`).toBe(true);
    }
  });

  it('the Angular harness keeps its workspace fixture', () => {
    const seed = harness('formio-angular-resources/fixtures/existing-workspace-seed');

    expect(existsSync(seed)).toBe(true);
    expect(existsSync(join(seed, 'angular.json'))).toBe(true);
    expect(existsSync(join(seed, 'src/app/app.module.ts'))).toBe(true);
  });

  it('the React harness keeps its workspace fixture', () => {
    const seed = harness('formio-react-resources/fixtures/existing-workspace-seed');

    expect(existsSync(seed)).toBe(true);
    expect(existsSync(join(seed, 'package.json'))).toBe(true);
    expect(existsSync(join(seed, 'src/formio/index.ts'))).toBe(true);
  });

  it('the planner harness keeps its template fixture', () => {
    const fixture = harness('formio-resource-planner/evals.json');

    expect(existsSync(fixture)).toBe(true);
  });

  it.each(RETIRED_LOCATIONS)('%s no longer exists', (retired) => {
    expect(existsSync(at(retired))).toBe(false);
  });
});

describe('each grader still resolves the repository root', () => {
  it.each(HARNESSES)('evals/%s/grade.py resolves to the repo root', (skill) => {
    const source = readFileSync(harness(skill, 'grade.py'), 'utf8');
    const match = source.match(/REPO_ROOT = Path\(__file__\)\.resolve\(\)((?:\.parent)+)/);

    expect(match, 'grade.py must derive REPO_ROOT from __file__').not.toBeNull();

    // packages/skill-tests/evals/<skill>/grade.py — five .parent hops reach the
    // repository root (harness, evals, skill-tests, packages, root).
    const parents = (match?.[1].match(/\.parent/g) ?? []).length;
    expect(parents).toBe(5);
  });

  it.each(HARNESSES)('evals/%s/grade.py writes under .eval-artifacts', (skill) => {
    const source = readFileSync(harness(skill, 'grade.py'), 'utf8');

    expect(source).toContain('.eval-artifacts');
    expect(source).toContain(skill);
  });
});

describe('the documented convention matches reality', () => {
  const claudeMd = () => readFileSync(at('CLAUDE.md'), 'utf8');

  it('names the new harness location', () => {
    expect(claudeMd()).toContain(`${NEW_ROOT}/<skill>/`);
  });

  it('no longer names the old one', () => {
    expect(claudeMd()).not.toContain('skills/<skill>/evals/');
  });

  it('points at the harnesses that exist', () => {
    const body = claudeMd();

    expect(body).not.toContain('plugin/skills/formio-resource-planner/evals');
    expect(body).not.toContain('formio-angular-resources/evals/');
  });
});

describe('both runbooks reference their own location', () => {
  it.each(HARNESSES)('evals/%s/README.md carries no shipped-tree path', (skill) => {
    const body = readFileSync(harness(skill, 'README.md'), 'utf8');

    expect(body).not.toContain('plugin/skills/formio-resource-planner/evals');
    expect(body).not.toContain('skills/formio-angular/formio-angular-resources/evals');
    expect(body).toContain(`${NEW_ROOT}/${skill}`);
  });
});
