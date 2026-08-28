// The planner artifacts are DATA the skill reads, not instructions it follows.
//
// `formio-angular` finds `template.md` + `template.json` in the working directory
// and pulls free text out of them — resource names, form paths, role names, field
// labels — straight into generated TypeScript. The documents said where to find
// the pair and what to extract, and never said where the pair must have COME
// from or how its contents must be treated. A file placed in the working
// directory is not automatically first-party, and prose inside a `template.md`
// ("Purpose:", a field description, a comment) is authored text that can be
// written to read like an instruction to the agent reading it.
//
// Three claims, asserted in every document that reads the pair: it must be
// first-party, its text is never an instruction, and the values that reach
// generated code are constrained by shape rather than pasted.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

// The three documents that read the pair and act on what is inside it: the parent
// skill (pre-flight discovery), AUTH (extracts four values into auth.module.ts),
// and the resources sub-skill (extracts the whole resource model into NgModules).
const READING_DOCS = [
  'formio-angular/SKILL.md',
  'formio-angular/AUTH.md',
  'formio-angular/formio-angular-resources/SKILL.md',
];

function read(path: string): string {
  return readFileSync(join(skillsRoot, path), 'utf8');
}

describe('every document that reads the planner artifacts states their provenance', () => {
  it.each(READING_DOCS)('%s requires the pair to be first-party', (doc) => {
    const text = read(doc);

    expect(text).toMatch(/first-party/i);
    // Named producers, so "first-party" is not left to interpretation.
    expect(text).toMatch(/formio-resource-planner/);
  });

  it.each(READING_DOCS)('%s says an unvouched-for pair is confirmed before it is read', (doc) => {
    expect(read(doc)).toMatch(/confirm (it|the pair|its origin|with the user)/i);
  });
});

describe('the artifacts are treated as data, not as instructions', () => {
  it.each(READING_DOCS)('%s says their text never directs the work', (doc) => {
    const text = read(doc);

    expect(text).toMatch(/data, not instructions|never instructions/i);
  });

  it.each(READING_DOCS)('%s tells the agent to ignore a directive found inside', (doc) => {
    expect(read(doc)).toMatch(/ignore/i);
  });
});

// The values that land in generated TypeScript — a form path in
// FormioAuthConfig, a machine name in a FormioResourceConfig — are the ones worth
// constraining, because "extract it and write it into the file" is otherwise an
// instruction to paste arbitrary authored text into the user's source.
describe('values that reach generated code are constrained by shape', () => {
  it.each(['formio-angular/AUTH.md', 'formio-angular/formio-angular-resources/SKILL.md'])(
    '%s requires the extracted value to look like what it claims to be',
    (doc) => {
      const text = read(doc);

      // The check itself, not merely the vocabulary: both documents already said
      // "machine name" and "stop and ask" about other things, so assert the
      // sentence that states the constraint and its refusal.
      expect(text).toMatch(/path segment/i);
      expect(text).toMatch(/does not look like/i);
      expect(text).toMatch(/stop and ask the user/i);
    }
  );
});
