// The Form.io project the folder resolves to is the source of truth, versioned
// with Form.io's own tags; template.json is an export of the newest tag. A change
// to a project that already has content is applied with the granular tools: a
// re-import updates every form it names in place and deletes and recreates its
// actions, and a template's access replaces the project's access lists.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skills = join(repoRoot, 'plugin/skills');
const read = (path: string): string => readFileSync(join(skills, path), 'utf8');

const APP = 'formio-application';

describe('import is described as what it is', () => {
  it.each([`${APP}/SKILL.md`, `${APP}/INTENT.md`, `${APP}/IMPORT.md`])(
    '%s makes no additive claim',
    (path) => {
      expect(read(path)).not.toMatch(/additiv/i);
    }
  );

  it('IMPORT.md states what the import replaces and that it is for a first build', () => {
    const imp = read(`${APP}/IMPORT.md`);
    expect(imp).toMatch(/actions are deleted and recreated/);
    expect(imp).toMatch(/replaces the project's access/);
    expect(imp).toMatch(/first build/);
    expect(imp).not.toMatch(/import merges into the existing project/);
  });

  it('no application document imports into an existing project', () => {
    expect(read(`${APP}/INTENT.md`)).not.toMatch(/`project_import` of the delta/);
    expect(read(`${APP}/SKILL.md`)).not.toMatch(/imports the delta template/);
  });
});

describe('CHANGE.md changes an existing project', () => {
  const path = join(skills, APP, 'CHANGE.md');
  const change = (): string => readFileSync(path, 'utf8');

  it('exists and is linked from SKILL.md', () => {
    expect(existsSync(path)).toBe(true);
    expect(read(`${APP}/SKILL.md`)).toMatch(/\(\.\/CHANGE\.md\)/);
  });

  it('checks the project against its current version before planning', () => {
    const text = change();
    expect(text).toMatch(/`project_tag_list` with `compare: true`/);
    expect(text).toMatch(/patch tag/);
    expect(text).toMatch(/`0\.1\.0`/);
  });

  it('applies the change plan with the granular tools, in dependency order, behind one gate', () => {
    const text = change();
    expect(text).toMatch(/roles, then resources, then forms, then actions/);
    for (const tool of ['role_create', 'form_create', 'form_get', 'form_update', 'action_create']) {
      expect(text).toContain(`\`${tool}\``);
    }
    expect(text).toMatch(/never call `project_import`/i);
    expect(text).toMatch(/stops the run[\s\S]{0,20}Report what was applied/);
    expect(text).toMatch(/change-plan\.md/);
  });

  it('finishes by proposing a semver tag, asking, tagging, and exporting it over template.json', () => {
    const text = change();
    expect(text).toMatch(/`1\.0\.0`/);
    expect(text).toMatch(/minor/);
    expect(text).toMatch(/patch/);
    expect(text).toMatch(/`project_tag_create`/);
    expect(text).toMatch(/`project_export` with `tag`[^.]*`template\.json`/);
    expect(text).toMatch(/declines[\s\S]{0,200}untagged/);
  });
});

describe('the project is the source of truth', () => {
  it('SKILL.md says template.json is the newest tag, never edited or re-imported', () => {
    const skill = read(`${APP}/SKILL.md`);
    expect(skill).toMatch(/`template\.json` is an export of the newest (version )?tag/);
    expect(skill).toMatch(/never edit `template\.json`/i);
    expect(skill).toMatch(/never re-import/i);
  });

  it('names deploying to another stage as work outside the agent', () => {
    expect(read(`${APP}/SKILL.md`)).toMatch(/deploy[^.]*(portal|CI\/CD)/i);
  });

  it('carries no licence fallback', () => {
    for (const path of [`${APP}/SKILL.md`, `${APP}/CHANGE.md`, `${APP}/IMPORT.md`]) {
      expect(read(path)).not.toMatch(/LICENSE_REQUIRED/);
    }
  });
});

describe('the extend handoff carries the change plan', () => {
  it('FRAMEWORK.md names changesJsonPath and no delta templateJsonPath', () => {
    const framework = read(`${APP}/FRAMEWORK.md`);
    expect(framework).toMatch(/`changesJsonPath`/);
    expect(framework).not.toMatch(/`templateJsonPath` \(delta\)/);
    expect(framework).not.toMatch(/delta template\.json/);
  });

  it.each([
    'formio-angular/formio-angular-resources/SKILL.md',
    'formio-react/formio-react-resources/SKILL.md',
  ])('%s reads new resource shapes from changesJsonPath', (path) => {
    expect(read(path)).toMatch(/`changesJsonPath`/);
  });
});
