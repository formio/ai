// The "Where these two values come from" paragraph is copied into every document
// that writes a Project URL or Base URL into an application. project-urls.md owns
// the rule: the Base URL is derived from the Project URL where it can be, and a
// Project URL is never built from a Base URL. Only SKILL.md copies are covered by
// the shared-prose suite, so this collects every copy.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillsRoot } from './skill-text.js';

const OPENING = '**Where these two values come from.**';

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

const copies = markdownFiles(skillsRoot).flatMap((path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith(OPENING))
    .map((line) => ({ path: relative(skillsRoot, path), line }))
);

// Copies differ only in the relative path to project-urls.md.
const normalized = (line: string): string =>
  line.replace(/\]\([^)]*project-urls\.md\)/g, '](project-urls.md)');

describe('shared URL-values paragraph', () => {
  it('has copies to check', () => {
    expect(copies.length).toBeGreaterThan(1);
  });

  it('is identical in every copy apart from its link', () => {
    const variants = new Set(copies.map(({ line }) => normalized(line)));
    expect(variants.size, copies.map(({ path }) => path).join('\n')).toBe(1);
  });

  it.each(copies.map(({ path, line }) => [path, line]))(
    '%s does not forbid the derivation it describes',
    (_path, line) => {
      expect(line).not.toMatch(/do not derive either URL from the other/);
      expect(line).toMatch(/never build a Project URL from a Base URL/);
    }
  );
});
