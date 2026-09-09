// A skill that documents an execution surface — the Evaluator compiling strings,
// a loader injecting scripts, a renderer executing a definition — is read as
// documenting an unbounded capability unless its SKILL.md says where trust ends.
// `formio-form` and `formio-sdk` both document such a surface and both carry a
// `## Security` section. The convention lives in CLAUDE.md so the next skill that
// documents one knows to carry its own, and this test keeps the two in step: the
// convention is stated, and every skill it names actually has the section.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SKILLS_WITH_AN_EXECUTION_SURFACE = [
  'plugin/skills/formio-sdk/SKILL.md',
  'plugin/skills/formio-form/SKILL.md',
  'plugin/skills/formio-react/formio-react-form/SKILL.md',
  'plugin/skills/formio-angular/formio-angular-form/SKILL.md',
];

describe('the Security-section convention', () => {
  it('is stated in CLAUDE.md’s skills-library guidance', () => {
    const claude = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
    expect(claude).toMatch(/`## Security` section/);
    expect(claude).toMatch(/execution surface/);
  });

  it.each(SKILLS_WITH_AN_EXECUTION_SURFACE)('%s carries a `## Security` heading', (rel) => {
    const body = readFileSync(join(repoRoot, rel), 'utf8');
    expect(body).toMatch(/^## Security/m);
  });
});
