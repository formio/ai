// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Surface-presence tests for the SDK references that exercise network /
// authentication endpoints (`setup.md`, `auth.md`, `forms.md`,
// `submissions.md`, `projects.md`, `roles.md`, `files.md`, `plugins.md`,
// `rendering.md`). These tests do not hit a real Form.io server — they
// verify that every method the references claim is actually exposed by
// `@formio/js`, with the right callable shape, so the reference doc cannot
// silently drift from the runtime SDK.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Formio } from '@formio/js';

type FormioStatic = typeof Formio & Record<string, unknown>;
type FormioInstance = InstanceType<typeof Formio> & Record<string, unknown>;

const HOSTED_BASE = 'https://forms.mysite.com';
const HOSTED_PROJECT = 'https://forms.mysite.com/myproject';
const SAAS_BASE = 'https://api.form.io';
const SAAS_PROJECT = 'https://myproject.form.io';

function staticMethod(name: string): unknown {
  return (Formio as unknown as Record<string, unknown>)[name];
}

function instanceMethod(formio: FormioInstance, name: string): unknown {
  return formio[name];
}

beforeAll(() => {
  Formio.setBaseUrl(HOSTED_BASE);
  Formio.setProjectUrl(HOSTED_PROJECT);
});

afterEach(() => {
  Formio.setBaseUrl(HOSTED_BASE);
  Formio.setProjectUrl(HOSTED_PROJECT);
});

describe('setup.md surface', () => {
  it('Formio.setBaseUrl / getBaseUrl round-trip', () => {
    Formio.setBaseUrl(HOSTED_BASE);
    expect(Formio.getBaseUrl()).toBe(HOSTED_BASE);
    Formio.setBaseUrl(SAAS_BASE);
    expect(Formio.getBaseUrl()).toBe(SAAS_BASE);
  });

  it('Formio.setProjectUrl / getProjectUrl round-trip', () => {
    Formio.setProjectUrl(HOSTED_PROJECT);
    expect(Formio.getProjectUrl()).toBe(HOSTED_PROJECT);
    Formio.setProjectUrl(SAAS_PROJECT);
    expect(Formio.getProjectUrl()).toBe(SAAS_PROJECT);
  });

  it('Formio.setAuthUrl is exposed', () => {
    expect(typeof staticMethod('setAuthUrl')).toBe('function');
  });

  it('Formio.setPathType is exposed', () => {
    expect(typeof staticMethod('setPathType')).toBe('function');
  });

  it('Formio.setToken / getToken are exposed and setToken(null) clears the cached JWT', async () => {
    expect(typeof staticMethod('setToken')).toBe('function');
    expect(typeof staticMethod('getToken')).toBe('function');
    // Install a fake token then clear it via setToken(null) — there is no
    // dedicated clearTokens helper. setToken always issues a `/current`
    // fetch to populate the cached user; that fetch fails offline, so
    // swallow the rejection — the token-cache mutation happens regardless.
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMiLCJleHAiOjk5OTk5OTk5OTl9.sig';
    await Formio.setToken(token).catch(() => undefined);
    expect(typeof Formio.getToken()).toBe('string');
    await Formio.setToken(null).catch(() => undefined);
    expect(Formio.getToken()).toBeFalsy();
  });

  it('Formio.setUser / getUser are exposed', () => {
    expect(typeof staticMethod('setUser')).toBe('function');
    expect(typeof staticMethod('getUser')).toBe('function');
  });

  it('Formio.requireLibrary / libraryReady are exposed', () => {
    expect(typeof staticMethod('requireLibrary')).toBe('function');
    expect(typeof staticMethod('libraryReady')).toBe('function');
  });

  it('Formio.cdn exposes baseUrl/setBaseUrl/libs', () => {
    const cdn = (Formio as unknown as { cdn?: Record<string, unknown> }).cdn;
    expect(cdn).toBeTruthy();
    expect(typeof cdn?.baseUrl).toBe('string');
    expect(typeof cdn?.setBaseUrl).toBe('function');
    expect(cdn?.libs).toBeTruthy();
  });

  it('Formio.addLibrary / addLoader are exposed', () => {
    expect(typeof staticMethod('addLibrary')).toBe('function');
    expect(typeof staticMethod('addLoader')).toBe('function');
  });
});

describe('auth.md surface', () => {
  const authStatics = [
    'currentUser',
    'logout',
    'setToken',
    'getToken',
    'ssoInit',
    'samlInit',
    'oktaInit',
    'oAuthCurrentUser',
    'oauthLogoutURI',
    'pageQuery',
  ];
  for (const name of authStatics) {
    it(`Formio.${name} is exposed`, () => {
      expect(typeof staticMethod(name)).toBe('function');
    });
  }
});

describe('forms.md surface', () => {
  function formInstance(): FormioInstance {
    return new Formio(`${HOSTED_PROJECT}/intake`) as FormioInstance;
  }

  it('Formio instance resolves form URL fields', () => {
    const formio = formInstance();
    expect(formio.projectUrl).toBe(HOSTED_PROJECT);
    expect(formio.formUrl).toBe(`${HOSTED_PROJECT}/intake`);
    expect(formio.formsUrl).toBe(`${HOSTED_PROJECT}/form`);
  });

  const formMethods = ['loadForm', 'saveForm', 'deleteForm', 'loadForms', 'getFormId'];
  for (const name of formMethods) {
    it(`new Formio(formUrl).${name} is a function`, () => {
      expect(typeof instanceMethod(formInstance(), name)).toBe('function');
    });
  }

  it('Formio.clearCache is exposed', () => {
    expect(typeof staticMethod('clearCache')).toBe('function');
  });
});

describe('submissions.md surface', () => {
  function subInstance(): FormioInstance {
    return new Formio(
      `${HOSTED_PROJECT}/intake/submission/000000000000000000000010`
    ) as FormioInstance;
  }

  const subMethods = [
    'loadSubmission',
    'saveSubmission',
    'deleteSubmission',
    'loadSubmissions',
    'availableActions',
    'actionInfo',
    'userPermissions',
    'canSubmit',
    'getDownloadUrl',
    'getTempToken',
  ];
  for (const name of subMethods) {
    it(`new Formio(submissionUrl).${name} is a function`, () => {
      expect(typeof instanceMethod(subInstance(), name)).toBe('function');
    });
  }
});

describe('projects.md surface', () => {
  function projInstance(): FormioInstance {
    return new Formio(HOSTED_PROJECT) as FormioInstance;
  }

  const projMethods = ['loadProject', 'saveProject', 'deleteProject', 'accessInfo', 'getProjectId'];
  for (const name of projMethods) {
    it(`new Formio(projectUrl).${name} is a function`, () => {
      expect(typeof instanceMethod(projInstance(), name)).toBe('function');
    });
  }

  it('Formio.accessInfo / Formio.projectRoles static helpers are exposed', () => {
    expect(typeof staticMethod('accessInfo')).toBe('function');
    expect(typeof staticMethod('projectRoles')).toBe('function');
  });
});

describe('roles.md surface', () => {
  function roleInstance(): FormioInstance {
    return new Formio(`${HOSTED_PROJECT}/role/000000000000000000000020`) as FormioInstance;
  }

  const roleMethods = ['loadRole', 'saveRole', 'deleteRole', 'loadRoles'];
  for (const name of roleMethods) {
    it(`new Formio(roleUrl).${name} is a function`, () => {
      expect(typeof instanceMethod(roleInstance(), name)).toBe('function');
    });
  }
});

describe('files.md surface', () => {
  function fileInstance(): FormioInstance {
    return new Formio(`${HOSTED_PROJECT}/intake`) as FormioInstance;
  }

  const fileMethods = ['uploadFile', 'downloadFile', 'deleteFile'];
  for (const name of fileMethods) {
    it(`new Formio(formUrl).${name} is a function`, () => {
      expect(typeof instanceMethod(fileInstance(), name)).toBe('function');
    });
  }

  it('Formio.Providers.providers.storage registry is exposed', () => {
    const Providers = (
      Formio as unknown as {
        Providers?: {
          providers?: { storage?: Record<string, unknown> };
          addProvider?: unknown;
        };
      }
    ).Providers;
    expect(Providers).toBeTruthy();
    expect(Providers?.providers?.storage).toBeTruthy();
    expect(typeof Providers?.addProvider).toBe('function');
  });
});

describe('plugins.md surface', () => {
  const pluginStatics = [
    'registerPlugin',
    'deregisterPlugin',
    'getPlugin',
    'pluginAlter',
    'pluginGet',
    'pluginWait',
  ];
  for (const name of pluginStatics) {
    it(`Formio.${name} is exposed`, () => {
      expect(typeof staticMethod(name)).toBe('function');
    });
  }

  it('register / lookup / deregister a plugin', () => {
    const plugin = {
      __name: 'logger',
      priority: 1,
      preRequest() {
        // no-op
      },
    };
    Formio.registerPlugin(plugin, 'logger');
    expect(Formio.getPlugin('logger')).toBe(plugin);
    expect(Formio.deregisterPlugin('logger')).toBe(true);
    expect(Formio.getPlugin('logger')).toBeFalsy();
  });

  it('pluginAlter folds a value through registered plugins', () => {
    const plugin = {
      __name: 'rewriter',
      priority: 1,
      rewriteUrl(value: string) {
        return `${value}?via=plugin`;
      },
    };
    Formio.registerPlugin(plugin, 'rewriter');
    try {
      const result = (Formio as unknown as FormioStatic).pluginAlter as (
        hook: string,
        value: unknown,
        ...args: unknown[]
      ) => unknown;
      expect(result('rewriteUrl', 'https://example/x', { formId: 'x' })).toBe(
        'https://example/x?via=plugin'
      );
    } finally {
      Formio.deregisterPlugin('rewriter');
    }
  });
});

describe('rendering.md surface', () => {
  const renderStatics = ['createForm', 'use', 'formioReady'];
  for (const name of renderStatics) {
    it(`Formio.${name} is exposed`, () => {
      const value = staticMethod(name);
      // `formioReady` is a Promise, others are callable.
      if (name === 'formioReady') {
        expect(value).toBeTruthy();
        expect(typeof (value as { then?: unknown })?.then).toBe('function');
      } else {
        expect(typeof value).toBe('function');
      }
    });
  }

  it('Formio.Templates / Formio.icons hooks are exposed', () => {
    expect((Formio as unknown as { Templates?: unknown }).Templates).toBeTruthy();
    // `icons` may be undefined until a template framework is loaded — only
    // assert the Templates hook the reference's API table calls out.
  });
});
