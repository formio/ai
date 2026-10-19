// Password reset is built from the Email action's `[[token(...)]]` macro plus Self
// Access, not from the Reset Password action, checked against the Form.io server
// (nirvana `apps/formio-server`): `src/util/util.js` `ssoTokens` reads the lifetime
// after the closing parenthesis and defaults it to 120 minutes;
// `src/middleware/logout.js` ends the request's session; a password change ends the
// user's other sessions (`invalidateTokens` in `src/hooks/settings.js`).

import { describe, expect, it } from 'vitest';
import { readSkillFile, section } from './skill-text.js';
import { descriptionOf } from '../skill-descriptions/helpers.js';

describe('formio-actions', () => {
  it.each(['formio-actions/SKILL.md', 'formio-actions/references/action-types.md'])(
    '%s documents no Reset Password action',
    (path) => {
      const body = readSkillFile(path);

      expect(body).not.toMatch(/resetpass/);
      expect(body).not.toContain('{{ resetlink }}');
      expect(body).not.toMatch(/## Reset Password|### Password reset flow/);
    }
  );

  it('sends password reset to formio-auth', () => {
    expect(readSkillFile('formio-actions/SKILL.md')).toMatch(
      /formio-auth\/references\/email-auth\.md[^\n]*Password reset/
    );
  });

  it('does not claim reset-password actions in its description', () => {
    expect(descriptionOf('formio-actions')).not.toMatch(/reset password/i);
  });
});

describe('formio-angular', () => {
  it('mounts the email-token reset page on the resetpass route', () => {
    const body = readSkillFile('formio-angular/AUTH.md');

    expect(body).toContain('FormioAuthRoutes({ resetpass: ResetPasswordComponent })');
    expect(body).toMatch(
      /sign out with `await Formio\.logout\(\)`, then call the injected `FormioAuthService`'s `setUser\(null\)`/
    );
    expect(body).toContain('formio-auth/references/email-auth.md');
  });
});

describe('formio-auth', () => {
  const emailAuth = readSkillFile('formio-auth/references/email-auth.md');

  it('states the token lifetime and its default', () => {
    const body = section(emailAuth, '### Token lifetime');

    expect(body).toMatch(/120 minutes/);
    expect(body).toMatch(/\[\[token\(data\.email=user\),\d+\]\]/);
  });

  it('builds password reset from the token and Self Access', () => {
    const body = section(emailAuth, '### Password reset');

    expect(body).toContain('[[token(data.email=user)]]');
    expect(body).toContain('Formio.pageQuery()');
    expect(body).toContain('Formio.setToken(');
    expect(body).toContain('Formio.logout()');
    expect(body).toContain('roles-and-permissions.md');
    expect(body).toMatch(/Self Access/);
    expect(body).not.toMatch(/resetpass/);
  });

  // currentUser() returns the stored user without a request unless told to ignore
  // the cache (packages/core/src/sdk/Formio.ts).
  it('every page that signs in from a link clears the stored session first', () => {
    const examples = [
      section(emailAuth, '### Password reset'),
      section(emailAuth, '### The application link is a callback URL'),
    ];

    for (const body of examples) {
      const clear = body.indexOf('await Formio.setToken(null);');
      expect(clear).toBeGreaterThan(-1);
      expect(clear).toBeLessThan(body.search(/Formio\.setToken\((token|query\.token)\)/));
    }
  });

  it('the reset page saves only data', () => {
    const body = section(emailAuth, '### Password reset');

    expect(body).toContain('saveSubmission({ data: { ...current.data, password } })');
    expect(body).not.toMatch(/saveSubmission\(\{ \.\.\.current/);
  });

  it('claims password reset in its description', () => {
    expect(descriptionOf('formio-auth')).toMatch(/password reset/);
  });
});
