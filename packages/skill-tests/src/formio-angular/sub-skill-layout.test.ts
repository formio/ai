// Structural tests for the nested `formio-angular-resources` sub-skill.
//
// The Agent Skills specification requires a skill's `name` to equal the name of
// the directory holding its SKILL.md. Claude Code never noticed the old
// `resources/` directory because the parent loads the file by path, but every
// other client discovers skills by recursive scan — where a mismatched name is
// a specification violation, and a 2,334-character description is over twice
// the 1,024-character maximum.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const parentDir = join(repoRoot, 'plugin/skills/formio-angular');
const subSkillDir = join(parentDir, 'formio-angular-resources');
const subSkillMd = join(subSkillDir, 'SKILL.md');
const DESCRIPTION_BUDGET = 1024;

const REQUIRED_TRIGGERS = [
  'add an Angular module',
  'regenerate the Angular',
  'in my Angular app',
] as const;

function frontmatterOf(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('SKILL.md has no YAML frontmatter block');
  }
  return match[1];
}

function descriptionOf(markdown: string): string {
  const frontmatter = frontmatterOf(markdown);
  const match = frontmatter.match(/^description: >-\n([\s\S]*?)(?=^\S|\s*$(?![\s\S]))/m);
  if (!match) {
    throw new Error('SKILL.md frontmatter has no folded description');
  }
  return match[1].split(/\s+/).filter(Boolean).join(' ');
}

function bodyOf(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---/, '');
}

describe('formio-angular-resources directory layout', () => {
  it('lives in a directory named after the skill', () => {
    expect(existsSync(subSkillMd)).toBe(true);
    expect(frontmatterOf(readFileSync(subSkillMd, 'utf8'))).toMatch(
      /^name: formio-angular-resources$/m
    );
  });

  it('no longer exists at the old resources/ path', () => {
    expect(existsSync(join(parentDir, 'resources'))).toBe(false);
  });

  it('keeps its reference material', () => {
    expect(existsSync(join(subSkillDir, 'references')), 'references/ is missing').toBe(true);
  });

  // The harness lives at packages/skill-tests/evals/formio-angular-resources/ instead: plugin/ is
  // copied into a consumer's project, and a grader has no meaning there.
  // Location and contents are asserted by shipped-surface/eval-harness-location.
  it('ships no eval harness inside the skill', () => {
    expect(existsSync(join(subSkillDir, 'evals'))).toBe(false);
  });
});

describe('formio-angular-resources description', () => {
  it('fits the 1,024-character specification budget', () => {
    const description = descriptionOf(readFileSync(subSkillMd, 'utf8'));

    expect(
      description.length,
      `description is ${description.length} chars (budget ${DESCRIPTION_BUDGET})`
    ).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });

  it('keeps every Angular-explicit trigger phrase', () => {
    const description = descriptionOf(readFileSync(subSkillMd, 'utf8'));

    for (const trigger of REQUIRED_TRIGGERS) {
      expect(description, `missing trigger: ${trigger}`).toContain(trigger);
    }
  });

  it('keeps the Not for clause pointing at the orchestrator', () => {
    const description = descriptionOf(readFileSync(subSkillMd, 'utf8'));

    expect(description).toContain('Not for');
    expect(description).toContain('formio-application');
  });

  it('claims no framework-agnostic extend phrasing', () => {
    const description = descriptionOf(readFileSync(subSkillMd, 'utf8'));

    for (const generic of ['also track', 'also let', 'add a way to see', 'let users do']) {
      expect(description.toLowerCase(), `claims generic phrasing: ${generic}`).not.toContain(
        generic
      );
    }
  });

  it('moves the trimmed narration into the body', () => {
    const body = bodyOf(readFileSync(subSkillMd, 'utf8')).toLowerCase();

    // The four supported feature shapes.
    expect(body).toContain('join');
    expect(body).toContain('transitive');
    expect(body).toMatch(/parent\s*(→|->|-)\s*child|parent→child|hierarch/);
    // The two-phase cadence.
    expect(body).toMatch(/phase a/);
    expect(body).toMatch(/phase b/);
  });
});

describe('links to the sub-skill', () => {
  const LIVE_DOCS = ['CLAUDE.md', 'README.md', 'plugin/README.md'];

  function markdownFilesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return markdownFilesUnder(full);
      }
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    });
  }

  it('no live skill file or top-level doc points at formio-angular/resources/', () => {
    const files = [
      ...markdownFilesUnder(join(repoRoot, 'plugin/skills')),
      ...LIVE_DOCS.map((doc) => join(repoRoot, doc)),
    ];

    const offenders = files.filter((file) =>
      readFileSync(file, 'utf8').includes('formio-angular/resources/')
    );

    expect(offenders.map((file) => file.replace(`${repoRoot}/`, ''))).toEqual([]);
  });

  it('no live skill file points at the bare ./resources/SKILL.md path', () => {
    const offenders = markdownFilesUnder(parentDir).filter((file) =>
      readFileSync(file, 'utf8').includes('./resources/SKILL.md')
    );

    expect(offenders.map((file) => file.replace(`${repoRoot}/`, ''))).toEqual([]);
  });

  it('the eval harness carries no stale sub-skill path', () => {
    const harness = join(repoRoot, 'packages/skill-tests/evals/formio-angular-resources');
    const gradePy = readFileSync(join(harness, 'grade.py'), 'utf8');
    const evalsJson = readFileSync(join(harness, 'evals.json'), 'utf8');

    expect(gradePy).not.toContain('formio-angular/resources');
    expect(evalsJson).not.toContain('formio-angular/resources');
  });

  it('the eval fixtures directory resolves from the harness', () => {
    const fixtures = join(repoRoot, 'packages/skill-tests/evals/formio-angular-resources/fixtures');

    expect(statSync(fixtures).isDirectory()).toBe(true);
    expect(readdirSync(fixtures).length).toBeGreaterThan(0);
  });
});
