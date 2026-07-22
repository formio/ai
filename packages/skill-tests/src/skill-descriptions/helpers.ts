// Shared helpers for the skill-description suites: enumerate top-level
// skills and extract each SKILL.md's whitespace-normalized description.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

export const DESCRIPTION_BUDGET = 1024;

// Top-level skills only — nested sub-skill files (e.g. formio-angular/resources)
// are loaded by path, not registered in the skill list, so they are exempt.
export function topLevelSkills(): string[] {
  return readdirSync(skillsRoot).filter((entry) => statSync(join(skillsRoot, entry)).isDirectory());
}

export function descriptionOf(skill: string): string {
  const skillMd = readFileSync(join(skillsRoot, skill, 'SKILL.md'), 'utf8');
  const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    throw new Error(`${skill}/SKILL.md has no YAML frontmatter block`);
  }
  // The description is a folded block (`description: >-`) running until the
  // next non-indented frontmatter key (e.g. formio-schema's `license: MIT`).
  const match = frontmatter[1].match(/^description: >-\n([\s\S]*?)(?=^\S|\s*$(?![\s\S]))/m);
  if (!match) {
    throw new Error(`${skill}/SKILL.md frontmatter has no folded description`);
  }
  return match[1].split(/\s+/).filter(Boolean).join(' ');
}
