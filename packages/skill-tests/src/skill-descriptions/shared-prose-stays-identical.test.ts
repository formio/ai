import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { comparable, shingles, words } from './prose-similarity.js';
import { ProseEntry, driftReport, findDrift } from './prose-drift.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

/**
 * The preflight prose is duplicated on purpose and must stay byte-identical.
 *
 * Every gated skill carries the same ~5KB of preflight — what to check, when to
 * check it, the one remedy to offer, the ban on raw HTTP, how to read `project_get`.
 * It cannot be factored out: each SKILL.md is loaded on its own, and a skill that
 * links away for its own preconditions has a precondition the agent may never read.
 *
 * So the copies are the mechanism, and drift between them is the failure. The
 * existing tests check that each copy CONTAINS certain tokens, which a partial
 * update passes: edit the paragraph in seven files, miss the eighth, and every
 * assertion still holds while two skills now tell an agent different things.
 *
 * This asserts the property those tests cannot: no two skills may carry paragraphs
 * that are NEARLY the same. Either a paragraph is shared, in which case it is
 * identical everywhere, or it is that skill's own, in which case it reads
 * differently enough not to be a stale copy of somebody else's.
 */

// Long enough to be prose rather than a heading, a link line, or a one-line note.
const PROSE_MIN_LENGTH = 120;

/**
 * Word overlap at or above this, with character similarity below the threshold, means
 * the same sentences in a different arrangement rather than two different paragraphs.
 */

/** The skill's own directory name, which is how everyone refers to it. */
function label(skillMdPath: string): string {
  return dirname(skillMdPath).split('/').pop() ?? skillMdPath;
}

function prose(skillMdPath: string): string[] {
  const text = readFileSync(skillMdPath, 'utf8');
  return text
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= PROSE_MIN_LENGTH)
    .filter((paragraph) => !paragraph.startsWith('```'));
}

// Every SKILL.md at any depth. A one-level walk missed the nested sub-skill at
// formio-angular/formio-angular-resources/, which carries ten byte-identical copies
// of this very prose and could therefore drift from all eleven siblings freely.
function everySkillMd(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return everySkillMd(full);
    }
    return entry.name === 'SKILL.md' ? [full] : [];
  });
}

describe('prose duplicated across skills is duplicated exactly', () => {
  // Every gated skill: the ones whose SKILL.md carries the preflight at all.
  const skills = everySkillMd(skillsRoot).filter((skillMdPath) =>
    readFileSync(skillMdPath, 'utf8').includes('project_get')
  );

  it('has gated skills to compare', () => {
    expect(skills.length).toBeGreaterThan(1);
  });

  it('carries no paragraph that is nearly — but not exactly — another skill’s', () => {
    // Indexed by what the paragraph SAYS, so the eleven byte-identical copies of the
    // shared preflight collapse to one entry carried by eleven skills and are never
    // compared against each other at all. Comparing per skill-PAIR re-derived the same
    // text and re-ran the same character-level comparison tens of thousands of times:
    // ~5s locally, and past the 20s timeout on a CI runner, which is a test that fails
    // for a reason unrelated to the property it guards.
    const byText = new Map<string, ProseEntry>();
    for (const skill of skills) {
      for (const raw of prose(skill)) {
        const text = comparable(raw);
        const entry = byText.get(text) ?? {
          text,
          raw,
          words: words(text),
          shingles: shingles(text),
          carriers: new Set(),
        };
        entry.carriers.add(label(skill));
        byText.set(text, entry);
      }
    }

    const drifted = findDrift([...byText.values()]);

    expect(drifted, driftReport(drifted)).toEqual([]);
  });
});
