// Where the source-fact suites read skill text from.

import { readFileSync } from 'node:fs';
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
