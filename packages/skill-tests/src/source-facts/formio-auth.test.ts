// Statements in `formio-auth` that an agent acts on, checked against what the
// Form.io server does (nirvana `apps/formio`, `apps/formio-server`) and against the
// tools the MCP server registers. Each test fails if the wrong statement comes back
// or the right one is deleted.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillReader, skillsRoot } from './skill-text.js';
import {
  CANONICAL_AUTH_PARAGRAPH,
  RUNTIME_AUTH_PARAGRAPH,
} from '../library-validation/validate-library.js';

const skillDir = join(skillsRoot, 'formio-auth');

const read = skillReader('formio-auth');
const reference = (name: string): string => read(`references/${name}`);
const references = (): string[] =>
  readdirSync(join(skillDir, 'references')).filter((name) => name.endsWith('.md'));

describe('the end-user JWT documents', () => {
  // Both describe the token an application sends for its end user; the portal-login
  // JWT belongs only to the MCP server's own tool calls.
  it.each(['jwt-and-sessions.md', 'resource-auth.md'])(
    '%s carries the runtime paragraph, not the canonical one',
    (name) => {
      const body = reference(name);

      expect(body).toContain(RUNTIME_AUTH_PARAGRAPH);
      expect(body).not.toContain(CANONICAL_AUTH_PARAGRAPH);
    }
  );
});

describe('tool names', () => {
  it('names no retired tool', () => {
    const offenders = ['SKILL.md', ...references().map((name) => `references/${name}`)].filter(
      (path) => /`(authenticate|action_types_list)`/.test(read(path))
    );

    expect(offenders).toEqual([]);
  });
});

describe('token swap', () => {
  // currentUser.js starts `roles` empty and adds no default.
  it('gives a user matching no mapping no role', () => {
    const body = reference('token-swap.md');

    expect(body).not.toMatch(/granted the default Form\.io Role/);
    expect(body).toMatch(/holds no Form\.io role, not Authenticated and not Anonymous/);
  });
});

describe('the email-token macro', () => {
  const body = reference('email-auth.md');

  it('gives the grammar, lifetime, and unmatched result', () => {
    expect(body).toContain('[[token(<fieldPath>=<resource>[,<resource>…])[,<minutes>]]]');
    expect(body).toMatch(/default 120/);
    expect(body).toContain('INVALID_TOKEN');
    expect(body).toMatch(/exactly one recipient/);
  });

  it('matches the field on the searched resource against the recipient address', () => {
    expect(body).not.toMatch(/the `email` field from the triggering submission's data/);
    expect(body).toMatch(/on the searched resource's records/);
  });

  it('belongs to the standard Email action', () => {
    expect(read('SKILL.md')).not.toMatch(/Email Authentication action/);
    expect(read('SKILL.md')).toMatch(/standard Email action/);
  });
});

describe('the Custom JWT project id', () => {
  // The export deletes `_id`; every form document carries the project's `_id`.
  it("reads it from a form's project field, not from project_export", () => {
    const body = reference('custom-jwt.md');

    expect(body).not.toMatch(/Use `project_export` to fetch the project `_id`/);
    expect(body).toMatch(/`select: "_id,project"`/);
  });
});

describe('roles and permissions', () => {
  const body = reference('roles-and-permissions.md');

  it('gives the Everyone role id with 24 zeros', () => {
    const match = /Everyone\*\* — .*?Fixed ID `(0+)`/.exec(body);

    expect(match?.[1]).toHaveLength(24);
  });

  it('links Form.io documentation with its host', () => {
    const hostless = references().filter((name) =>
      /(?<![\w.:/])\/developers\/[\w/-]+/.test(reference(name))
    );

    expect(hostless).toEqual([]);
  });

  // RoleAction's method is fixed to create; editing a user never runs it.
  it('describes the persona Role Assignment actions as create-only', () => {
    expect(body).not.toMatch(/creating or editing a user/);
    expect(body).toMatch(/run on create only/);
  });
});
