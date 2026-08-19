import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, normalizeHttpUrl } from '../config.js';

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_BASE_URL;
    delete process.env.FORMIO_PROJECT_URL;
    delete process.env.FORMIO_DEFAULT_PROJECT_URL;
    delete process.env.FORMIO_API_KEY;
    delete process.env.FORMIO_LOGIN_FORM;
    delete process.env.FORMIO_FORCE_BROWSER;
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // The hosted-cloud default lands in resolveProjectConfig rather than here.
  // Defaulting at read time made "the environment said nothing" and "the
  // environment said api.form.io" indistinguishable during resolution, and a
  // directory that mapped its own deployment lost to the pre-filled default.
  it('leaves baseUrl unset when FORMIO_BASE_URL is not set', () => {
    expect(getConfig().baseUrl).toBeUndefined();
  });

  it('reads FORMIO_BASE_URL and strips the trailing slash', () => {
    process.env.FORMIO_BASE_URL = 'https://forms.example.com/';

    expect(getConfig().baseUrl).toBe('https://forms.example.com');
  });

  // A URL pasted into an interview answer or a host prompt carries the spaces
  // around it. new URL() tolerates them, so the value validates and is then
  // stored, keys the token cache, and is concatenated into request URLs —
  // reaching the user as the opaque parse failure this validation prevents.
  it('trims surrounding whitespace from FORMIO_BASE_URL', () => {
    process.env.FORMIO_BASE_URL = '  https://forms.example.com/  ';

    expect(getConfig().baseUrl).toBe('https://forms.example.com');
  });

  it('does not throw when FORMIO_PROJECT_URL is not set — tools stay discoverable', () => {
    expect(() => getConfig()).not.toThrow();
    expect(getConfig().projectUrl).toBeUndefined();
  });

  it('reads FORMIO_PROJECT_URL from env and strips the trailing slash', () => {
    process.env.FORMIO_PROJECT_URL = 'https://my-project.form.io/';

    expect(getConfig().projectUrl).toBe('https://my-project.form.io');
  });

  // An empty value is how a host that prompts for an optional Project URL and
  // gets no answer passes it through (.mcpb, plugin manifests). Treated as a
  // value, it pins the server to nothing and no mapping can ever redirect it.
  it('treats an empty FORMIO_PROJECT_URL as unset', () => {
    process.env.FORMIO_PROJECT_URL = '';

    expect(getConfig().projectUrl).toBeUndefined();
  });

  // The offering variable is gone: it existed only because FORMIO_PROJECT_URL
  // pinned the server, and the scope reorder made the environment the weakest
  // source, so a project set there is already overridden by both stronger sources.
  it('does not read FORMIO_DEFAULT_PROJECT_URL at all', () => {
    process.env.FORMIO_DEFAULT_PROJECT_URL = 'https://suggested.form.io';

    expect(Object.keys(getConfig())).not.toContain('defaultProjectUrl');
  });

  // Both plugin manifests set these from a host variable, and an unsubstituted
  // "${FORMIO_BASE_URL}" is truthy. Taken raw it keys the token cache and builds
  // the portal-login URL, and the user meets it as an opaque
  // "TypeError: Failed to parse URL from" out of fetch.
  it('drops a FORMIO_BASE_URL that is not a valid URL', () => {
    process.env.FORMIO_BASE_URL = '${FORMIO_BASE_URL}';

    expect(getConfig().baseUrl).toBeUndefined();
  });

  it('drops a FORMIO_BASE_URL that uses a non-http protocol', () => {
    process.env.FORMIO_BASE_URL = 'ftp://forms.example.com';

    expect(getConfig().baseUrl).toBeUndefined();
  });

  it('ignores a FORMIO_PROJECT_URL that is not a valid URL', () => {
    process.env.FORMIO_PROJECT_URL = '${user_config.formio_project_url}';

    expect(getConfig().projectUrl).toBeUndefined();
  });

  it('ignores a FORMIO_PROJECT_URL on a non-http protocol', () => {
    process.env.FORMIO_PROJECT_URL = 'ftp://project.example.com';

    expect(getConfig().projectUrl).toBeUndefined();
  });

  it('reads FORMIO_API_KEY when set', () => {
    process.env.FORMIO_API_KEY = 'abc123';

    expect(getConfig().apiKey).toBe('abc123');
  });

  it('reads FORMIO_LOGIN_FORM when set', () => {
    process.env.FORMIO_LOGIN_FORM = 'https://forms.example.com/formio/user/login';

    expect(getConfig().loginFormUrl).toBe('https://forms.example.com/formio/user/login');
  });

  it('has a mutable jwt field that is initially undefined', () => {
    const config = getConfig();

    expect(config.jwt).toBeUndefined();
    config.jwt = 'some-token';
    expect(config.jwt).toBe('some-token');
  });

  it('surfaces FORMIO_FORCE_BROWSER as forceBrowser', () => {
    process.env.FORMIO_FORCE_BROWSER = '1';

    expect(getConfig().forceBrowser).toBe(true);
  });

  it('leaves forceBrowser false when FORMIO_FORCE_BROWSER is unset', () => {
    expect(getConfig().forceBrowser).toBe(false);
  });

  // FORMIO_PLUGIN_CONTEXT used to switch the defaults: baseUrl became required
  // and projectUrl was ignored in favour of the per-cwd map. One binary now
  // behaves one way for every agent, so a stale value in the environment of an
  // old launcher must change nothing.
  describe('a stale FORMIO_PLUGIN_CONTEXT has no effect', () => {
    beforeEach(() => {
      process.env.FORMIO_PLUGIN_CONTEXT = '1';
    });

    it('still does not require baseUrl', () => {
      expect(() => getConfig()).not.toThrow();
      expect(getConfig().baseUrl).toBeUndefined();
    });

    it('still reads FORMIO_PROJECT_URL from the environment', () => {
      process.env.FORMIO_PROJECT_URL = 'https://example.form.io';

      expect(getConfig().projectUrl).toBe('https://example.form.io');
    });
  });
});

// The normalized value is what gets persisted, cached against, and concatenated
// into request URLs, so it has to be the string new URL() accepted — not the
// caller's raw input, which may differ from it by whitespace.
describe('normalizeHttpUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeHttpUrl(' https://api.form.io ', 'baseUrl')).toBe('https://api.form.io');
  });

  it('trims whitespace before stripping the trailing slash', () => {
    expect(normalizeHttpUrl('\thttps://forms.example.com/ \n', 'baseUrl')).toBe(
      'https://forms.example.com'
    );
  });

  // Host case is significant to string equality and to nothing else. Two
  // spellings of one deployment would be two token-cache keys, and a pin whose
  // host is capitalized would miss the mapping written for the same project.
  it('lowercases the host without touching the path', () => {
    expect(normalizeHttpUrl('https://Examples.Form.io', 'projectUrl')).toBe(
      'https://examples.form.io'
    );
    expect(normalizeHttpUrl('https://Forms.MySite.com/MyProject', 'projectUrl')).toBe(
      'https://forms.mysite.com/MyProject'
    );
  });

  it('rejects a value that is not a URL, naming the label and the value', () => {
    expect(() => normalizeHttpUrl('${FORMIO_BASE_URL}', 'baseUrl')).toThrow(
      /baseUrl.*\$\{FORMIO_BASE_URL\}/
    );
  });

  it('rejects a non-http protocol', () => {
    expect(() => normalizeHttpUrl('ftp://forms.example.com', 'baseUrl')).toThrow(/http/);
  });
});
