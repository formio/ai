// The planner's description of action order and of persona Role Assignment
// actions, checked against the Form.io server.
//
// Sources (nirvana): apps/formio/src/actions/actions.js (`.sort('-priority')`,
// then a filter by handler and method), RoleAction.js (handler `after`, method
// `create`, neither editable), templates/default.json (the same priorities the
// planner emits).

import { describe, expect, it } from 'vitest';
import { readSkillFile } from './skill-text.js';

const read = readSkillFile;

const TEMPLATE_JSON = 'formio-resource-planner/references/template-json.md';
const EMISSION = 'formio-resource-planner/references/phase-b-emission.md';

describe('formio-resource-planner: action priority', () => {
  it('does not say a higher priority runs later', () => {
    expect(read(TEMPLATE_JSON)).not.toMatch(/higher runs later/);
  });

  it('says the higher number runs first within a handler phase', () => {
    expect(read(TEMPLATE_JSON)).toMatch(
      /Within one handler phase, actions run in descending priority order \(the higher number runs first\)/
    );
  });

  it('describes the register-form order the emitted handlers and numbers produce', () => {
    const emission = read(EMISSION);
    expect(emission).not.toMatch(/Save always has the lowest priority number/);
    expect(emission).not.toMatch(/Login runs last on register forms/);
    expect(emission).toMatch(/Login \(`before`, 2\) runs next/);
    expect(emission).toMatch(
      /Role Assignment \(`after`, 1\) runs once the request has stored its result/
    );
  });
});

describe('persona Role Assignment actions run on create only', () => {
  const PERSONA_DOCS = [
    TEMPLATE_JSON,
    EMISSION,
    'formio-actions/references/action-types.md',
    'formio-auth/references/roles-and-permissions.md',
  ];

  it.each(PERSONA_DOCS)('%s does not say they cover edited users', (path) => {
    const text = read(path);
    expect(text).not.toMatch(/creates or edits (a|the) user/);
    expect(text).not.toMatch(/created or edited/);
    expect(text).not.toMatch(/creating or editing a user/);
    expect(text).not.toMatch(/the portal edits the same user form/);
  });

  it.each([TEMPLATE_JSON, 'formio-actions/references/action-types.md'])(
    '%s states they run on create only, by design',
    (path) => {
      const text = read(path);
      expect(text).toMatch(/run when a user record is \*\*created\*\*/);
      expect(text).toMatch(/Changing an existing user's persona is an administrator task/);
    }
  );
});
