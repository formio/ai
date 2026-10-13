// A change to a project that already has content is applied with the form, role,
// and action tools, never by re-importing a template: re-importing a form deletes
// and recreates its actions, and a template's `access` replaces the project's
// access lists (apps/formio/src/templates/import.js, hooks/settings.js). So in
// change mode the planner emits a change plan — only what the change creates,
// plus the updates to existing forms — and never an import template.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const planner = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../plugin/skills/formio-resource-planner'
);
const read = (path: string): string => readFileSync(join(planner, path), 'utf8');
const CHANGE_PLAN = 'references/change-plan.md';

describe('the planner documents change mode', () => {
  it('has references/change-plan.md', () => {
    expect(existsSync(join(planner, CHANGE_PLAN))).toBe(true);
  });

  it('is entered with a baseline template', () => {
    expect(read(CHANGE_PLAN)).toMatch(/baseline template/);
    expect(read(CHANGE_PLAN)).toMatch(/current tag's template|current export/);
  });

  it('marks what the change adds or modifies in Phase A', () => {
    expect(read(CHANGE_PLAN)).toMatch(/Phase A[^.]*\(new\)[^.]*\(changed\)/);
  });

  it('appends a dated change section to template.md', () => {
    expect(read(CHANGE_PLAN)).toMatch(/## Change — <YYYY-MM-DD> — /);
  });

  it('emits changes.json with an updates list', () => {
    const text = read(CHANGE_PLAN);
    expect(text).toMatch(/`changes\.json`/);
    expect(text).toMatch(/"updates"/);
    expect(text).toMatch(/"addComponents"/);
  });

  it('carries no top-level access, references baseline machine names, repeats nothing unchanged', () => {
    const text = read(CHANGE_PLAN);
    expect(text).toMatch(/no top-level `access`/);
    expect(text).toMatch(/baseline machine name/);
    expect(text).toMatch(/never repeats an unchanged/);
  });

  it('never produces an import template', () => {
    const text = read(CHANGE_PLAN);
    expect(text).toMatch(/never writes or modifies `template\.json`/);
    expect(text).toMatch(/not a template for `project_import`/);
  });

  it('is linked from SKILL.md', () => {
    expect(read('SKILL.md')).toMatch(/\(references\/change-plan\.md\)/);
  });
});
