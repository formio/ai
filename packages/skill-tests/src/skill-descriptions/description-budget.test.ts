// Library-wide description contract from the `skill-description-budget` spec:
// every top-level skill's frontmatter description must fit the 1,024-character
// budget (whitespace-normalized), carry a `Not for:` clause, and contain
// routing content only — no shell commands, URLs, or phase narrations.
//
// Rationale: the agent's skill listing truncates long descriptions (observed
// at ~1,535 characters), and the library's `Not for:` clauses sit last — the
// budget is what guarantees they stay visible.

import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, allSkills, descriptionOf, topLevelSkills } from './helpers.js';

// The combined budget. Claude Code loads every registered skill's name and description
// into one listing whose budget is 1% of the context window (about 8,000 characters on a
// 200k-token model), and over it drops the descriptions of the least-used skills, which
// is what routing depends on. Every installed skill and plugin shares that listing, so
// this library cannot fit it alone; it keeps its own share bounded instead, and a new
// skill pays for its description by tightening the others rather than growing the total.
// Measured over the top-level skills, which are the ones Claude Code registers.
export const LIBRARY_LISTING_BUDGET = 9_600;

describe('skill description budget', () => {
  // Every skill in the library, nested ones included: the budget is also the
  // Agent Skills specification's hard maximum, and clients other than Claude
  // Code register nested skills by recursive scan.
  it.each(allSkills().map((skill) => [skill.path, skill.description] as const))(
    `%s description is at most ${DESCRIPTION_BUDGET} characters (normalized)`,
    (path, description) => {
      expect(
        description.length,
        `${path} description is ${description.length} chars (budget ${DESCRIPTION_BUDGET})`
      ).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    }
  );

  it.each(topLevelSkills())('%s description contains a Not for clause', (skill) => {
    expect(descriptionOf(skill)).toContain('Not for');
  });

  it.each(topLevelSkills())('%s description carries no body content', (skill) => {
    const description = descriptionOf(skill);
    expect(description, `${skill} description contains a shell command`).not.toContain('npx ');
    expect(description, `${skill} description contains a URL`).not.toContain('https://');
    expect(description, `${skill} description narrates numbered phases`).not.toMatch(
      /\(\d\)\s+[A-Z]{2,}/
    );
  });

  it(`keeps the top-level descriptions within ${LIBRARY_LISTING_BUDGET} characters combined`, () => {
    const total = topLevelSkills().reduce((sum, skill) => sum + descriptionOf(skill).length, 0);
    expect(
      total,
      `top-level descriptions total ${total} chars (library budget ${LIBRARY_LISTING_BUDGET})`
    ).toBeLessThanOrEqual(LIBRARY_LISTING_BUDGET);
  });
});
