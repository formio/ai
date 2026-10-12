// What formio-sdk tells an agent about authentication, providers, validation and
// role deletion, checked against the installed @formio/js. Each fact was read in
// the Form.io source (packages/core/src/sdk/Formio.ts, packages/formio.js/src);
// a test asserts the corrected statement is present AND the old one is gone, and
// where the package can answer the question itself, asks it.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillReader, skillsRoot } from './skill-text.js';
import { Formio } from '@formio/js';
import { createForm } from '../formio-form/renderer-harness.js';

const skillDir = join(skillsRoot, 'formio-sdk');
const read = skillReader('formio-sdk');

function everyMarkdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return everyMarkdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

/** The body of one `## <heading>` section — everything up to the next `## `. */
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}`);
  if (start === -1) return '';
  const rest = markdown.slice(start + 1);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The fenced code block that follows a `### <heading>`. */
function exampleUnder(markdown: string, heading: string): string {
  const start = markdown.indexOf(`### ${heading}`);
  if (start === -1) return '';
  const fence = markdown.indexOf('```', start);
  const body = markdown.indexOf('\n', fence) + 1;
  return markdown.slice(body, markdown.indexOf('```', body));
}

describe('login', () => {
  it('@formio/js has no static Formio.login', () => {
    expect((Formio as unknown as Record<string, unknown>).login).toBeUndefined();
  });

  it('no document under formio-sdk calls Formio.login', () => {
    const offenders = everyMarkdownUnder(skillDir)
      .filter((path) => /Formio\.login\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(skillDir, path));
    expect(offenders).toEqual([]);
  });

  it('SKILL.md names a submission to the login form as the login call', () => {
    const auth = section(read('SKILL.md'), 'Authentication');
    expect(auth).toMatch(/\/user\/login`\)\.saveSubmission/);
    expect(auth).toMatch(/installs the JWT/);
  });

  it('auth.md names the URL the login submission posts to', () => {
    expect(read('references/auth.md')).toContain('/user/login/submission');
  });
});

describe('SSO', () => {
  const example = exampleUnder(read('references/auth.md'), 'SSO');

  it('the example calls ssoInit on the page the provider returns to and branches on false', () => {
    expect(example).toContain('Formio.ssoInit(');
    expect(example).toMatch(/=== false/);
  });

  it('the example reads no token from the query string itself', () => {
    expect(example).not.toMatch(/query\.token/);
    expect(example).not.toMatch(/pageQuery\(\)/);
  });

  it('the Okta example passes Okta Auth JS settings, not `authority`', () => {
    expect(example).toContain('issuer');
    expect(example).not.toContain('authority');
  });

  it('ssoInit is documented as consuming the callback and resolving false while redirecting', () => {
    const api = section(read('references/auth.md'), 'API');
    const ssoInit = api.split('\n').find((line) => line.includes('`Formio.ssoInit(')) ?? '';
    expect(ssoInit).toMatch(/`false`/);
    expect(ssoInit).toContain('saml');
    expect(ssoInit).not.toMatch(/URL hash/);
  });
});

describe('current user and logout', () => {
  const api = section(read('references/auth.md'), 'API');
  const line = (name: string) => api.split('\n').find((l) => l.includes(`\`Formio.${name}(`)) ?? '';

  it('logout is a GET and emits formio.user', () => {
    expect(line('logout')).toMatch(/GET/);
    expect(line('logout')).toContain('formio.user');
    expect(read('references/auth.md')).not.toMatch(/POST \/logout/);
  });

  it('currentUser resolves against the project URL before the Base URL and emits formio.user', () => {
    expect(line('currentUser')).toMatch(/projectUrl \|\| baseUrl/);
    expect(line('currentUser')).toContain('formio.user');
    expect(line('currentUser')).not.toMatch(/decodes the JWT/);
  });

  it('the decoded-token example tests a claim, because getToken returns {} with no token', () => {
    expect(Formio.getToken({ decode: true })).toEqual({});
    const example = exampleUnder(read('references/auth.md'), 'Read the decoded JWT');
    expect(example).not.toMatch(/!claims \|\|/);
    expect(example).toMatch(/!claims\.exp/);
  });

  it('pathType is documented without a default', () => {
    const setup = read('references/setup.md');
    expect(setup).not.toMatch(/default to `Subdirectories`/);
    expect(setup).toMatch(
      /`pathType`[^\n]*undefined by default|undefined by default[^\n]*pathType/
    );
  });
});

describe('custom storage provider', () => {
  const example = exampleUnder(read('references/files.md'), 'Register a custom storage provider');

  it('is declared with function or class, not an arrow function', () => {
    expect(example).not.toMatch(/addProvider\([^)]*,\s*\(formio\)\s*=>/);
    expect(example).toMatch(/^function \w+\(formio\)|^class \w+/m);
    expect(example).toMatch(/\.title = /);
  });

  it('a provider declared that way is constructible the way the SDK calls it', () => {
    function customCdn() {
      return { uploadFile: () => Promise.resolve({}) };
    }
    const arrow = () => ({ uploadFile: () => Promise.resolve({}) });
    Formio.Providers.addProvider('storage', 'factsCustomCdn', customCdn);
    const Provider = Formio.Providers.getProvider('storage', 'factsCustomCdn');
    expect(typeof new Provider({}).uploadFile).toBe('function');
    expect(() => new (arrow as unknown as new () => unknown)()).toThrow(TypeError);
  });
});

interface ValidatingForm {
  submission: { data: unknown };
  validate(data: unknown, flags: { dirty: boolean }): unknown[];
}

describe('validation', () => {
  it('validate() returns an array of errors synchronously', async () => {
    // The renderer instance is untyped in @formio/js; name only what the example calls.
    const form = (await createForm({
      components: [{ type: 'textfield', key: 'name', label: 'Name', validate: { required: true } }],
    })) as unknown as ValidatingForm;
    const errors = form.validate(form.submission.data, { dirty: true });
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rendering.md does not document validate as Promise<boolean>', () => {
    const doc = read('references/rendering.md');
    expect(doc).not.toMatch(/validate\(\): Promise<boolean>/);
    expect(doc).toMatch(/`form\.validate\([^`]*\)[^`]*`[^\n]*array/);
  });

  it('the example checks the array length', () => {
    const example = exampleUnder(
      read('references/rendering.md'),
      'Programmatic submit + validation'
    );
    expect(example).not.toMatch(/await form\.validate\(\)/);
    expect(example).toMatch(/errors\.length/);
  });
});

describe('role deletion', () => {
  it('roles.md says no MCP tool deletes a role and the user confirms the deletion', () => {
    const preference = section(read('references/roles.md'), 'MCP Tool Preference');
    expect(preference).toMatch(/no MCP tool deletes a role/i);
    expect(preference).toMatch(/confirm/i);
    expect(preference).toMatch(/Roles page/);
  });
});

describe('the Security section addresses everything returned to the agent', () => {
  const body = section(read('SKILL.md'), 'Security');

  it('covers whatever any Formio call or MCP tool returns', () => {
    expect(body).toMatch(/any `Formio` call or MCP tool/);
  });

  it('does not claim that no tool returns submission data', () => {
    expect(body).not.toMatch(/none (of them )?returns? submission data/i);
  });

  it('does not name Formio.login', () => {
    expect(body).not.toContain('Formio.login');
  });
});
