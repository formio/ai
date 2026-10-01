// The Role Assignment action's `existing` association takes its target from a
// component keyed exactly `submission` (nirvana `apps/formio/src/actions/RoleAction.js`).
// The library once described that component only as "a component whose value is the
// target resource's submission ID", which reads as though any key will do — and a
// form keyed `user` does not assign the role to the intended user.
//
// The configuration the library recommends for an `existing` action is pinned here
// too: the target key, an explicit `settings.role`, and create access limited to
// administrator roles.

import { describe, expect, it } from 'vitest';
import { allSkillDocuments, skillDocument } from './helpers.js';

const paragraphs = (body: string): string[] => body.split(/\n\s*\n/);

// A paragraph about the Role Assignment action's `existing` association. The OAuth
// action also has an `association` setting, but its values are `new` / `remote`.
const describesExistingAssociation = (paragraph: string): boolean =>
  /association/i.test(paragraph) && /\bexisting\b/.test(paragraph) && !/remote/.test(paragraph);

describe("the Role Assignment action's `existing` association", () => {
  it('names the `submission` key wherever it is described', () => {
    const offenders = allSkillDocuments().flatMap(({ path, body }) =>
      paragraphs(body)
        .filter(describesExistingAssociation)
        .filter((paragraph) => !/`submission`/.test(paragraph))
        .map((paragraph) => `${path}: ${paragraph.trim().slice(0, 120)}`)
    );

    expect(offenders).toEqual([]);
  });

  it.each([
    'plugin/skills/formio-actions/references/action-types.md',
    'plugin/skills/formio-resource-planner/references/template-json.md',
  ])('%s recommends an explicit role and administrator-only create access', (path) => {
    const { body } = skillDocument(path);
    const guidance = paragraphs(body)
      .filter((paragraph) => /\bexisting\b/.test(paragraph))
      .join('\n\n');

    expect(guidance).toMatch(/exactly `submission`/);
    expect(guidance).toMatch(/`settings\.role` explicitly/);
    expect(guidance).toMatch(/`create_all`/);
    expect(guidance).toMatch(/administrator roles only/);
  });
});
