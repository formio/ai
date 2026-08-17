// Library-wide Agent Skills specification conformance
// (https://agentskills.io/specification), enforced over EVERY SKILL.md in the
// library — nested sub-skills included, because every client other than Claude
// Code discovers skills by recursive directory scan.
//
// Four rules: name charset, name/directory agreement, description length, and a
// closed set of frontmatter keys.

import { describe, expect, it } from 'vitest';
import { SkillUnderTest, skillConformanceIssues } from './conformance.js';
import {
  DESCRIPTION_BUDGET,
  allSkillDocuments,
  allSkills,
  directoryNameOf,
  toPosixPath,
  topLevelSkills,
} from './helpers.js';

function synthetic(overrides: Partial<SkillUnderTest> = {}): SkillUnderTest {
  return {
    path: 'plugin/skills/example/SKILL.md',
    directoryName: 'example',
    frontmatter: { name: 'example', description: 'What it does. Use when asked.' },
    description: 'What it does. Use when asked.',
    ...overrides,
  };
}

describe('skill enumeration', () => {
  it('finds every top-level skill', () => {
    const paths = allSkills().map((skill) => skill.path);

    for (const skill of topLevelSkills()) {
      expect(paths).toContain(`plugin/skills/${skill}/SKILL.md`);
    }
  });

  it('finds the nested Angular resources sub-skill', () => {
    const paths = allSkills().map((skill) => skill.path);

    expect(paths).toContain('plugin/skills/formio-angular/formio-angular-resources/SKILL.md');
  });

  // The suite runs on whatever machine a contributor has. A POSIX-only split
  // would make every skill fail name/directory agreement on Windows, where the
  // enumerated paths are backslash-separated — a red suite that says nothing
  // about the library.
  it('takes the directory name from either path separator', () => {
    expect(directoryNameOf('plugin/skills/formio-api/SKILL.md')).toBe('formio-api');
    expect(directoryNameOf('C:\\repo\\plugin\\skills\\formio-api\\SKILL.md')).toBe('formio-api');
  });

  // The reported path is compared against POSIX literals — the exemption list,
  // and every `startsWith('plugin/skills/…')` filter in these suites — so a
  // platform-separated path is not merely cosmetic: on Windows it makes those
  // comparisons miss, and a rule runs over a document written to be exempt.
  it('reports document paths POSIX-separated on every platform', () => {
    expect(toPosixPath('plugin\\skills\\formio-mcp-setup\\SKILL.md')).toBe(
      'plugin/skills/formio-mcp-setup/SKILL.md'
    );
    expect(toPosixPath('plugin/skills/formio-mcp-setup/SKILL.md')).toBe(
      'plugin/skills/formio-mcp-setup/SKILL.md'
    );
    expect(allSkillDocuments().every((doc) => !doc.path.includes('\\'))).toBe(true);
  });

  it('records each skill directory name alongside its declared name', () => {
    const subSkill = allSkills().find(
      (skill) => skill.frontmatter.name === 'formio-angular-resources'
    );

    expect(subSkill?.directoryName).toBe('formio-angular-resources');
  });
});

describe('the shipped library conforms', () => {
  it('reports no conformance issues for any skill', () => {
    const issues = allSkills().flatMap((skill) => skillConformanceIssues(skill));

    expect(issues.map((issue) => `${issue.path}: ${issue.rule} — ${issue.message}`)).toEqual([]);
  });
});

describe('skillConformanceIssues', () => {
  it('accepts a conformant skill', () => {
    expect(skillConformanceIssues(synthetic())).toEqual([]);
  });

  it('rejects a name that does not match its directory', () => {
    const issues = skillConformanceIssues(
      synthetic({
        directoryName: 'widget',
        frontmatter: { name: 'formio-widget', description: 'd' },
      })
    );

    expect(issues.map((issue) => issue.rule)).toContain('name.directory_mismatch');
    expect(issues[0].message).toContain('widget');
  });

  it('rejects a name with illegal characters', () => {
    const issues = skillConformanceIssues(
      synthetic({
        directoryName: 'Formio_Widget',
        frontmatter: { name: 'Formio_Widget', description: 'd' },
      })
    );

    expect(issues.map((issue) => issue.rule)).toContain('name.charset');
  });

  it('rejects a name with consecutive hyphens', () => {
    const issues = skillConformanceIssues(
      synthetic({
        directoryName: 'formio--widget',
        frontmatter: { name: 'formio--widget', description: 'd' },
      })
    );

    expect(issues.map((issue) => issue.rule)).toContain('name.charset');
  });

  it('rejects a name with a leading or trailing hyphen', () => {
    for (const name of ['-widget', 'widget-']) {
      const issues = skillConformanceIssues(
        synthetic({ directoryName: name, frontmatter: { name, description: 'd' } })
      );

      expect(
        issues.map((issue) => issue.rule),
        name
      ).toContain('name.charset');
    }
  });

  it('rejects a name longer than 64 characters', () => {
    const name = 'a'.repeat(65);
    const issues = skillConformanceIssues(
      synthetic({ directoryName: name, frontmatter: { name, description: 'd' } })
    );

    expect(issues.map((issue) => issue.rule)).toContain('name.length');
  });

  it('rejects a missing name', () => {
    const issues = skillConformanceIssues(synthetic({ frontmatter: { description: 'd' } }));

    expect(issues.map((issue) => issue.rule)).toContain('name.missing');
  });

  it('rejects an empty description', () => {
    const issues = skillConformanceIssues(
      synthetic({ description: '', frontmatter: { name: 'example', description: '' } })
    );

    expect(issues.map((issue) => issue.rule)).toContain('description.empty');
  });

  it('rejects a description over the 1,024-character budget', () => {
    const description = 'x'.repeat(DESCRIPTION_BUDGET + 1);
    const issues = skillConformanceIssues(
      synthetic({ description, frontmatter: { name: 'example', description } })
    );

    const budgetIssue = issues.find((issue) => issue.rule === 'description.budget');
    expect(budgetIssue?.message).toContain(String(DESCRIPTION_BUDGET + 1));
  });

  it('rejects a frontmatter key outside the specification set', () => {
    const issues = skillConformanceIssues(
      synthetic({
        frontmatter: { name: 'example', description: 'd', model: 'opus', tools: 'Read' },
      })
    );

    const keyIssues = issues.filter((issue) => issue.rule === 'frontmatter.unknown_key');
    expect(keyIssues).toHaveLength(2);
    expect(keyIssues.map((issue) => issue.message).join(' ')).toContain('model');
  });

  it('accepts every optional key the specification allows', () => {
    const issues = skillConformanceIssues(
      synthetic({
        frontmatter: {
          name: 'example',
          description: 'd',
          license: 'MIT',
          compatibility: 'Requires git',
          metadata: 'author: example-org',
          'allowed-tools': 'Read',
        },
      })
    );

    expect(issues).toEqual([]);
  });
});
