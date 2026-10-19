// Self Access, checked against the Form.io server (nirvana
// `apps/formio-server/node_modules/formio/src/middleware`) and live against a 9.9.2
// deployment: `permissionHandler.getSelfAccessPermissions` reads the `{ type: 'self' }`
// entry, `hasAccess` then grants a user their role's `*_own` permissions on the record
// whose `_id` is theirs, and `ownerFilter` adds that record to their index — whatever the
// record's `owner` holds. Users created with `owner` omitted, `null`, and `''` all read
// and updated their own record with the entry on. So the skills teach the entry and a
// role, and never ask for an `owner` value.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { markdownFiles, readSkillFile, section, skillsRoot } from './skill-text.js';

describe('formio-auth', () => {
  const rolesAndPermissions = readSkillFile('formio-auth/references/roles-and-permissions.md');

  it('describes Self Access by its entry and the role it needs, not by owner', () => {
    const body = section(rolesAndPermissions, '### Self Access and user onboarding');

    expect(body).toContain('{ "type": "self" }');
    expect(body).toMatch(/update_own/);
    expect(body).toMatch(/Role Assignment/);
    expect(body).toMatch(/whatever the record's `owner` holds/);
    expect(body).toMatch(/needs no `owner` field/);
  });

  it('no longer tells the reader to write the record id into owner', () => {
    expect(rolesAndPermissions).not.toMatch(/write the submission's own `_id` into its `owner`/);
  });

  it('gives the onboarding workflow Self Access and a role', () => {
    const body = section(
      readSkillFile('formio-auth/references/email-auth.md'),
      '### Typical user onboarding workflow'
    );

    expect(body).toMatch(/Self Access/);
    expect(body).toMatch(/Role Assignment/);
  });
});

describe('formio-resource-planner', () => {
  it('puts the self entry on the canonical user resource', () => {
    const body = section(
      readSkillFile('formio-resource-planner/references/template-json.md'),
      '## The canonical `user` resource'
    );

    expect(body).toContain('{ "type": "self", "roles": [] }');
  });

  // The planner copies its examples, so they carry the canonical entry too.
  it.each(['task-manager', 'complex-crm-transitive'])(
    'the %s example user resource carries Self Access',
    (example) => {
      const template = JSON.parse(
        readSkillFile(`formio-resource-planner/references/examples/${example}/template.json`)
      ) as { resources: { user: { submissionAccess: { type: string }[] } } };

      expect(template.resources.user.submissionAccess.map(({ type }) => type)).toContain('self');
    }
  );
});

describe('formio-schema', () => {
  it('describes the self access type', () => {
    expect(readSkillFile('formio-schema/references/form/form-definition.md')).toMatch(
      /`self` .*own record/
    );
  });
});

describe('the whole library', () => {
  // Self Access does not depend on `owner`, so no document asks for a value — not the
  // empty string, not null — and no framework skill generates code to send one.
  it('never asks for an owner value or generates code for one', () => {
    const offenders = markdownFiles(skillsRoot).filter((path) =>
      /owner:\s*(''|null)|"owner":\s*(""|null)|selfOwned|UserCreateComponent/.test(
        readFileSync(path, 'utf8')
      )
    );

    expect(offenders).toEqual([]);
  });
});
