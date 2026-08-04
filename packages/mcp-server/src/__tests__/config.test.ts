import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../config.js';

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_BASE_URL;
    delete process.env.FORMIO_PROJECT_URL;
    delete process.env.FORMIO_API_KEY;
    delete process.env.FORMIO_LOGIN_FORM;
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('plugin context (FORMIO_PLUGIN_CONTEXT=1)', () => {
    beforeEach(() => {
      process.env.FORMIO_PLUGIN_CONTEXT = '1';
    });

    it('throws when FORMIO_BASE_URL is not set — plugin collects it via user-config', () => {
      expect(() => getConfig()).toThrow(/FORMIO_BASE_URL is required/);
    });

    it('returns config when FORMIO_BASE_URL is set', () => {
      process.env.FORMIO_BASE_URL = 'https://api.form.io';
      expect(getConfig()).toEqual({
        baseUrl: 'https://api.form.io',
        apiKey: undefined,
        loginFormUrl: undefined,
        jwt: undefined,
      });
    });

    it('leaves projectUrl undefined when FORMIO_PROJECT_URL is not set', () => {
      process.env.FORMIO_BASE_URL = 'https://api.form.io';
      expect(getConfig().projectUrl).toBeUndefined();
    });

    it('does not require FORMIO_PROJECT_URL — the SessionStart hook drives per-cwd project_set', () => {
      process.env.FORMIO_BASE_URL = 'https://api.form.io';
      expect(() => getConfig()).not.toThrow();
    });
  });

  describe('standalone context (FORMIO_PLUGIN_CONTEXT unset)', () => {
    // A missing project URL must not stop the server from starting. Clients (and
    // directory crawlers) launch it with no configuration at all to read
    // tools/list; throwing here killed the process before it could answer, so the
    // server appeared to expose no tools. resolveProjectConfig raises a far more
    // actionable error at call time, which is where the value is actually needed.
    it('does not throw when FORMIO_PROJECT_URL is not set — tools stay discoverable', () => {
      expect(() => getConfig()).not.toThrow();
      expect(getConfig().projectUrl).toBeUndefined();
    });

    it('reads FORMIO_PROJECT_URL from env and strips trailing slash', () => {
      process.env.FORMIO_PROJECT_URL = 'https://api.form.io/my-project/';

      expect(getConfig().projectUrl).toBe('https://api.form.io/my-project');
    });

    it('reads FORMIO_BASE_URL from env and strips trailing slash', () => {
      process.env.FORMIO_PROJECT_URL = 'https://api.form.io/my-project';
      process.env.FORMIO_BASE_URL = 'https://forms.example.com/';

      expect(getConfig().baseUrl).toBe('https://forms.example.com');
    });

    it('reads FORMIO_API_KEY when set', () => {
      process.env.FORMIO_PROJECT_URL = 'https://api.form.io/my-project';
      process.env.FORMIO_API_KEY = 'abc123';

      expect(getConfig().apiKey).toBe('abc123');
    });

    it('reads FORMIO_LOGIN_FORM when set', () => {
      process.env.FORMIO_PROJECT_URL = 'https://api.form.io/my-project';
      process.env.FORMIO_LOGIN_FORM = 'https://forms.example.com/formio/user/login';

      expect(getConfig().loginFormUrl).toBe('https://forms.example.com/formio/user/login');
    });

    it('has a mutable jwt field that is initially undefined', () => {
      process.env.FORMIO_PROJECT_URL = 'https://api.form.io/my-project';

      const config = getConfig();
      expect(config.jwt).toBeUndefined();
      config.jwt = 'some-token';
      expect(config.jwt).toBe('some-token');
    });
  });
});
