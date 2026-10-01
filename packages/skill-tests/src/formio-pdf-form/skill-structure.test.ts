// Structural tests for the `formio-pdf-form` skill (plugin/skills/formio-pdf-form/):
// layout, the three-clause description and its PDF-first trigger surface, the lane
// table, and the dev symlink. Skill names are matched backtick-delimited, because
// `formio-form` is a substring of `formio-pdf-form`'s neighbors' names.

import { describe, expect, it } from 'vitest';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESCRIPTION_BUDGET, descriptionOf } from '../skill-descriptions/helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-pdf-form');
const skillMdPath = join(skillDir, 'SKILL.md');

export const REFERENCES = [
  'build.md',
  'enrich.md',
  'existing-form.md',
  'pdf-template.md',
  'render.md',
  'download.md',
] as const;

const read = (path: string) => readFileSync(path, 'utf8');

describe('formio-pdf-form layout', () => {
  it('SKILL.md declares name: formio-pdf-form', () => {
    expect(existsSync(skillMdPath)).toBe(true);
    expect(read(skillMdPath)).toMatch(/^---\nname: formio-pdf-form\n/);
  });

  it.each(REFERENCES)('references/%s exists, is non-empty, and has no frontmatter', (ref) => {
    const path = join(skillDir, 'references', ref);
    expect(existsSync(path), `${ref} missing`).toBe(true);
    const content = read(path);
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content.startsWith('---')).toBe(false);
  });

  it('ships no eval harness inside the plugin', () => {
    expect(existsSync(join(skillDir, 'evals'))).toBe(false);
  });

  it('.claude/skills/formio-pdf-form resolves to the skill directory', () => {
    const link = join(repoRoot, '.claude/skills/formio-pdf-form');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(skillDir));
  });
});

describe('formio-pdf-form description', () => {
  const description = () => descriptionOf('formio-pdf-form');
  const triggers = () => description().slice(0, description().indexOf('Not for:'));
  const notFor = () => description().slice(description().indexOf('Not for:'));

  it('fits the budget and carries the trigger and negative clauses', () => {
    expect(description().length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    expect(description()).toContain('Use when the user asks to');
    expect(description()).toContain('Not for:');
  });

  it.each([
    'turn this PDF into a form',
    'make this PDF fillable online',
    'pdf form',
    'fix the labels on my PDF form',
    'replace the PDF behind this form',
    "design the PDF for my form's submissions",
    'download a submission as PDF',
  ])('claims "%s"', (phrase) => {
    expect(triggers().toLowerCase()).toContain(phrase.toLowerCase());
  });

  it.each(['formio-form-builder', 'formio-form', 'formio-schema', 'formio-api'])(
    'Not for: names `%s`',
    (sibling) => {
      expect(notFor()).toContain(`\`${sibling}\``);
    }
  );
});

describe('formio-pdf-form routing', () => {
  it('SKILL.md links every lane reference from its navigation table', () => {
    const body = read(skillMdPath);
    for (const ref of REFERENCES) {
      expect(body, `${ref} not linked`).toContain(`(./references/${ref})`);
    }
  });
});
