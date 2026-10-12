// formio-schema's access shapes, checked against the Form.io server's schemas.
//
// Sources (nirvana): apps/formio/src/middleware/addSubmissionResourceAccess.js
// (clears and rebuilds submission `access` on every write), models/AccessSchema.js
// (submission access types, keyed by `resources`), models/PermissionSchema.js
// (form and project access types, keyed by `roles`).

import { describe, expect, it } from 'vitest';
import { readSkillFile } from './skill-text.js';

const read = readSkillFile;

const SUBMISSION_ACCESS = 'formio-schema/references/submission/submission-access.md';
const SUBMISSION_DEFINITION = 'formio-schema/references/submission/submission-definition.md';
const FORM_DEFINITION = 'formio-schema/references/form/form-definition.md';
const PROJECT_ACCESS = 'formio-schema/references/project/project-access.md';

const SUBMISSION_TYPES = ['read', 'create', 'update', 'delete', 'write', 'admin'];

// Every `"access": [...]` array in the document's JSON code blocks.
function accessArrays(markdown: string): unknown[][] {
  const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
  const found: unknown[][] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'access' && Array.isArray(child)) found.push(child);
        visit(child);
      }
    }
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block));
    } catch {
      // Not every fence is a complete JSON document; those are skipped.
    }
  }
  return found;
}

describe('formio-schema: submission access', () => {
  it('states the server computes `access` on every write', () => {
    const text = read(SUBMISSION_ACCESS);
    expect(text).toMatch(/computed by the server on every create and update/);
    expect(text).toMatch(/any `access` in the request body is discarded/);
    expect(text).not.toMatch(/Use it to open a single submission to specific users/);
  });

  it('the submission definition does not call `access` an override applied by the client', () => {
    expect(read(SUBMISSION_DEFINITION)).not.toMatch(
      /Row-level access overrides applied to this specific submission/
    );
  });

  it('the submission definition example uses submission access types keyed by `resources`', () => {
    const arrays = accessArrays(read(SUBMISSION_DEFINITION));
    expect(arrays.length).toBeGreaterThan(0);
    for (const entry of arrays.flat()) {
      const { type, resources, roles } = entry as {
        type?: string;
        resources?: unknown;
        roles?: unknown;
      };
      expect(SUBMISSION_TYPES).toContain(type);
      expect(Array.isArray(resources)).toBe(true);
      expect(roles).toBeUndefined();
    }
  });
});

describe('formio-schema: form and project access types', () => {
  it('form-definition.md lists every permission type, including `read_own` and `self`', () => {
    const text = read(FORM_DEFINITION);
    for (const type of [
      'create_all',
      'read_all',
      'update_all',
      'delete_all',
      'create_own',
      'read_own',
      'update_own',
      'delete_own',
      'self',
    ]) {
      expect(text).toContain(`\`${type}\``);
    }
  });

  it('project-access.md does not claim one type set for every layer', () => {
    const text = read(PROJECT_ACCESS);
    expect(text).not.toMatch(/the same set used at every layer/);
    expect(text).toMatch(/resource-keyed set/);
  });
});
