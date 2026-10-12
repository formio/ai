// Where the source-fact suites read skill text from.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const skillsRoot = join(repoRoot, 'plugin/skills');

/** Reads a file by its path under `plugin/skills/`. */
export const readSkillFile = (path: string): string => readFileSync(join(skillsRoot, path), 'utf8');

/** Reads a file by its path under `plugin/skills/<skill>/`. */
export const skillReader =
  (skill: string) =>
  (path: string): string =>
    readSkillFile(join(skill, path));

/** Every markdown file under `dir`, recursively. */
export function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

/**
 * The section a heading opens, from the heading line (given in full, `#`s
 * included) to the next heading of the same or a higher level outside a code
 * fence. Throws when the heading is missing, so an assertion about the section
 * cannot pass because there was nothing to read.
 */
export function section(markdown: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length;
  if (!level) throw new Error(`"${heading}" is not a markdown heading`);
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start === -1) throw new Error(`no "${heading}" heading`);
  const closes = new RegExp(`^#{1,${level}} `);
  const { end } = lines.slice(start + 1).reduce(
    (state, line, offset) => {
      if (state.end !== -1) return state;
      if (line.startsWith('```')) return { ...state, fenced: !state.fenced };
      return !state.fenced && closes.test(line) ? { ...state, end: start + 1 + offset } : state;
    },
    { fenced: false, end: -1 }
  );
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

/** The first fenced code block in the section a heading opens. */
export function exampleUnder(markdown: string, heading: string): string {
  const body = section(markdown, heading);
  const fence = body.indexOf('```');
  if (fence === -1) throw new Error(`no code block under "${heading}"`);
  const start = body.indexOf('\n', fence) + 1;
  return body.slice(start, body.indexOf('```', start));
}
