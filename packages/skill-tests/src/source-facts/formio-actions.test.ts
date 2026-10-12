// Statements in formio-actions that an agent acts on, checked against what the
// Form.io server does. Each test fails both when the corrected statement is
// removed and when the statement it replaced comes back.
//
// Sources (nirvana): apps/formio/src/actions/actions.js (sort, handler filter),
// LoginAction.js (lockout), WebhookAction.js and the Enterprise webhook action,
// util/email/index.js (email filtering), EmailAction.js (template).

import { describe, expect, it } from 'vitest';
import { readSkillFile, section } from './skill-text.js';

const read = readSkillFile;

const SKILL = 'formio-actions/SKILL.md';
const TYPES = 'formio-actions/references/action-types.md';

describe('formio-actions: action priority', () => {
  it('states that priority orders actions only within a handler phase', () => {
    const priority = section(read(SKILL), '### Priority — Execution order');
    expect(priority).toMatch(/Higher numbers run first/);
    expect(priority).toMatch(/every `before` action runs before every `after` action/i);
  });
});

describe('formio-actions: Login lockout', () => {
  it('says no lockout applies unless allowedAttempts is set', () => {
    const skill = read(SKILL);
    expect(skill).not.toMatch(/after 5 failed attempts within 30 seconds, the account locks/);
    expect(skill).toMatch(
      /only when the action's `settings\.allowedAttempts` is a non-zero number/
    );
    expect(skill).not.toMatch(/`allowedAttempts` \(default 5\)/);
  });

  it('says a locked login answers 401, even for the correct password', () => {
    expect(read(SKILL)).toMatch(/including one with the correct password, returns 401/);
  });

  it('gives allowedAttempts no server default in the settings table', () => {
    const row = read(TYPES)
      .split('\n')
      .find((line) => line.includes('`allowedAttempts`') && line.startsWith('|'));
    expect(row).toBeDefined();
    expect(row).toMatch(/unset \(no lockout\)/);
  });
});

describe('formio-actions: webhook', () => {
  it('describes the open-source and Enterprise webhook separately', () => {
    for (const path of [SKILL, TYPES]) {
      const text = read(path);
      expect(text, path).toMatch(/open-source server/i);
      expect(text, path).toMatch(/Enterprise/);
    }
  });

  it('does not tell the reader to interpolate `{{ data._id }}` into a webhook URL', () => {
    expect(read(TYPES)).not.toMatch(/\{\{ data\._id \}\}/);
  });

  it('does not document `{{ data.type }}` as working on every server', () => {
    expect(read(SKILL)).not.toMatch(
      /The webhook URL supports interpolation: `https:\/\/api\.example\.com\/\{\{ data\.type \}\}\/submit`\./
    );
  });

  it('names the Enterprise payload, which has no `response` key', () => {
    expect(read(TYPES)).toMatch(/Enterprise sends `\{ request, submission, params \}`/);
  });

  it('lists the Enterprise-only settings', () => {
    const types = read(TYPES);
    for (const key of ['method', 'headers', 'transform', 'externalIdType', 'retryType']) {
      expect(types).toContain(`\`${key}\``);
    }
  });
});

describe('formio-actions: email', () => {
  it('states exactly what the Email action filters and what it does not', () => {
    const skill = read(SKILL);
    expect(skill).not.toMatch(/Templates substitute the raw value/);
    expect(skill).toMatch(
      /each string value that a form component holds in `data` has its HTML tags removed/
    );
    expect(skill).toMatch(/does not touch non-string values/);
  });

  it('does not say an unset template uses a default wrapper', () => {
    expect(read(TYPES)).not.toMatch(/default wrapper/);
    expect(read(TYPES)).toMatch(/With `template` unset or empty, the email is the `message` alone/);
  });
});

describe('formio-actions: action_type_get', () => {
  it('names both of its arguments', () => {
    expect(read(SKILL)).toMatch(
      /Call `action_type_get` with the form's `formId`[^\n]*`actionName`/
    );
  });
});

// The open-source webhook never reads the response body and records `{}`; only an
// Enterprise webhook in a before handler stores the response with the submission.
describe('formio-actions: blocking webhook response', () => {
  it('the SKILL.md bullet states which server and handler store the response', () => {
    const skill = read(SKILL);
    expect(skill).not.toMatch(/whatever that host returns becomes part of the record/);
    const bullet =
      skill.split('\n').find((line) => line.startsWith('- **A blocking webhook')) ?? '';
    expect(bullet).toMatch(/open-source/);
    expect(bullet).toMatch(/Enterprise/);
  });
});
