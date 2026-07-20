// Library-wide description contract from the `skill-description-budget` spec:
// every top-level skill's frontmatter description must fit the 1,024-character
// budget (whitespace-normalized), carry a `Not for:` clause, and contain
// routing content only — no shell commands, URLs, or phase narrations.
//
// Rationale: the agent's skill listing truncates long descriptions (observed
// at ~1,535 characters), and the library's `Not for:` clauses sit last — the
// budget is what guarantees they stay visible.

import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, descriptionOf, topLevelSkills } from './helpers.js';

describe('skill description budget', () => {
  it.each(topLevelSkills())(
    `%s description is at most ${DESCRIPTION_BUDGET} characters (normalized)`,
    (skill) => {
      const description = descriptionOf(skill);
      expect(
        description.length,
        `${skill} description is ${description.length} chars (budget ${DESCRIPTION_BUDGET})`
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
});
