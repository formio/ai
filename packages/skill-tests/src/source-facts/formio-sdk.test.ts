// What formio-sdk tells an agent about authentication, providers, validation and
// role deletion, checked against the installed @formio/js. Each fact was read in
// the Form.io source (packages/core/src/sdk/Formio.ts, packages/formio.js/src);
// a test asserts the corrected statement is present AND the old one is gone, and
// where the package can answer the question itself, asks it.

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exampleUnder, markdownFiles, section, skillReader, skillsRoot } from './skill-text.js';
import { Formio } from '@formio/js';
import { createForm } from '../formio-form/renderer-harness.js';

const skillDir = join(skillsRoot, 'formio-sdk');
const read = skillReader('formio-sdk');

describe('login', () => {
  it('@formio/js has no static Formio.login', () => {
    expect((Formio as unknown as Record<string, unknown>).login).toBeUndefined();
  });

  it('no document under formio-sdk calls Formio.login', () => {
    const offenders = markdownFiles(skillDir)
      .filter((path) => /Formio\.login\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(skillDir, path));
    expect(offenders).toEqual([]);
  });

  it('SKILL.md names a submission to the login form as the login call', () => {
    const auth = section(read('SKILL.md'), '## Authentication');
    expect(auth).toMatch(/\/user\/login`\)\.saveSubmission/);
    expect(auth).toMatch(/installs the JWT/);
  });

  it('auth.md names the URL the login submission posts to', () => {
    expect(read('references/auth.md')).toContain('/user/login/submission');
  });
});

describe('SSO', () => {
  const example = exampleUnder(read('references/auth.md'), '### SSO');

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
    const api = section(read('references/auth.md'), '## API');
    const ssoInit = api.split('\n').find((line) => line.includes('`Formio.ssoInit(')) ?? '';
    expect(ssoInit).toMatch(/`false`/);
    expect(ssoInit).toContain('saml');
    expect(ssoInit).not.toMatch(/URL hash/);
  });
});

describe('current user and logout', () => {
  const api = section(read('references/auth.md'), '## API');
  const line = (name: string) => api.split('\n').find((l) => l.includes(`\`Formio.${name}(`)) ?? '';

  it('logout is a GET and emits formio.user', () => {
    expect(line('logout')).toMatch(/GET/);
    expect(line('logout')).toContain('formio.user');
    expect(read('references/auth.md')).not.toMatch(/POST \/logout/);
  });

  it('currentUser resolves against the project URL before the Base URL and emits formio.user', () => {
    // authUrl, else the passed instance's project URL (no fallback to the globals),
    // else the global project URL or Base URL.
    expect(line('currentUser')).toMatch(/passed instance's project URL \(with no fallback/);
    expect(line('currentUser')).toMatch(/global project URL or Base URL/);
    expect(line('currentUser')).not.toMatch(/formio\?\.projectUrl \|\| projectUrl/);
    expect(line('currentUser')).toContain('formio.user');
    expect(line('currentUser')).not.toMatch(/decodes the JWT/);
  });

  it('the decoded-token example tests a claim, because getToken returns {} with no token', () => {
    expect(Formio.getToken({ decode: true })).toEqual({});
    const example = exampleUnder(read('references/auth.md'), '### Read the decoded JWT');
    expect(example).not.toMatch(/!claims \|\|/);
    expect(example).toMatch(/!claims\.exp/);
  });

  // setToken installs the token and returns currentUser(), so it resolves the user
  // the token signs in; an empty token resolves null (packages/core/src/sdk/Formio.ts).
  it.each(['references/auth.md', 'references/setup.md'])(
    '%s says setToken resolves the user, and null when clearing',
    (path) => {
      const body = read(path);

      expect(body).toMatch(/setToken\(token: string[^)]*\): Promise<User \| null>/);
      expect(body).toMatch(/setToken\(null\): Promise<null>/);
      expect(body).not.toMatch(/setToken\([^)]*\): Promise<void>/);
    }
  );

  it('setToken with an empty token resolves null', async () => {
    await expect(Formio.setToken('')).resolves.toBeNull();
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
  const example = exampleUnder(
    read('references/files.md'),
    '### Register a custom storage provider'
  );

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
      '### Programmatic submit + validation'
    );
    expect(example).not.toMatch(/await form\.validate\(\)/);
    expect(example).toMatch(/errors\.length/);
  });
});

describe('role deletion', () => {
  it('roles.md says no MCP tool deletes a role and the user confirms the deletion', () => {
    const preference = section(read('references/roles.md'), '## MCP Tool Preference');
    expect(preference).toMatch(/no MCP tool deletes a role/i);
    expect(preference).toMatch(/confirm/i);
    expect(preference).toMatch(/Roles page/);
  });
});

describe('the Security section addresses everything returned to the agent', () => {
  const body = section(read('SKILL.md'), '## Security');

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

// samlInit checks only for its own `?saml=` callback: called with no callback it
// redirects, even when a session exists. Starting SSO on every load would send a
// signed-in user back to the provider.
describe('SSO runs only without a session', () => {
  const auth = read('references/auth.md');

  it('documents ssoInit as the call made when no session is held', () => {
    expect(auth).not.toMatch(/call it on every page load/);
    expect(auth).toMatch(/`Formio\.ssoInit[^\n]*no token/);
  });

  it('the SSO example reuses an existing session before starting SSO', () => {
    const example = auth.slice(auth.indexOf('### SSO'), auth.indexOf('### Logout'));
    expect(example).toMatch(/Formio\.getToken\(\)/);
    expect(example.indexOf('Formio.getToken()')).toBeLessThan(example.indexOf('Formio.ssoInit('));
    expect(example).not.toMatch(/Run on every page load/);
  });
});
