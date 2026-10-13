// The skills whose code examples are checked against the installed packages.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PACKAGE_ROOT } from './compile.js';
import { type Example, extractExamples } from './extract.js';

export const SKILLS_ROOT = join(PACKAGE_ROOT, '..', '..', 'plugin', 'skills');

export const CHECKED_SKILLS = ['formio-sdk', 'formio-form', 'formio-react/formio-react-form'];

/** Packages whose imports are checked; their subpaths (`@formio/js/utils`) count. */
export const CHECKED_PACKAGES = ['@formio/js', '@formio/core', '@formio/react'];

function markdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

export function skillExamples(skills: string[] = CHECKED_SKILLS): Example[] {
  return skills.flatMap((skill) =>
    markdownUnder(join(SKILLS_ROOT, skill)).flatMap((path) =>
      extractExamples(relative(SKILLS_ROOT, path), readFileSync(path, 'utf8'))
    )
  );
}
