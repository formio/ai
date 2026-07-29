import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormioConfig } from '../config.js';
import { buildCwdSchema, resolveProjectConfig } from '../project-resolver.js';

describe('cwd is only required in plugin context', () => {
  const baseConfig: FormioConfig = {
    baseUrl: 'https://api.form.io',
    projectUrl: 'https://mcptest.form.io',
    apiKey: 'abc',
  };

  const original = process.env.FORMIO_PLUGIN_CONTEXT;

  beforeEach(() => {
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.FORMIO_PLUGIN_CONTEXT;
    } else {
      process.env.FORMIO_PLUGIN_CONTEXT = original;
    }
  });

  describe('standalone (no FORMIO_PLUGIN_CONTEXT)', () => {
    // The per-cwd map is deliberately ignored outside the plugin, so demanding
    // cwd forced callers to supply a value that could not affect the outcome.
    it('accepts a missing cwd', () => {
      expect(buildCwdSchema().safeParse(undefined).success).toBe(true);
    });

    it('resolves from FORMIO_PROJECT_URL when cwd is omitted', () => {
      const cfg = resolveProjectConfig(undefined, baseConfig);
      expect(cfg.projectUrl).toBe('https://mcptest.form.io');
      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    it('still resolves when a cwd is supplied, and ignores it', () => {
      const cfg = resolveProjectConfig('/anywhere', baseConfig);
      expect(cfg.projectUrl).toBe('https://mcptest.form.io');
    });

    // A relative path cannot be honoured either way here, so rejecting it would
    // only be noise.
    it('does not reject a non-absolute cwd it is going to ignore', () => {
      expect(() => resolveProjectConfig('relative/path', baseConfig)).not.toThrow();
    });

    it('still fails clearly when no project URL is configured at all', () => {
      expect(() => resolveProjectConfig(undefined, { baseUrl: 'https://api.form.io' })).toThrow(
        /FORMIO_PROJECT_URL/
      );
    });
  });

  describe('plugin context (FORMIO_PLUGIN_CONTEXT=1)', () => {
    beforeEach(() => {
      process.env.FORMIO_PLUGIN_CONTEXT = '1';
    });

    it('still requires cwd in the schema', () => {
      expect(buildCwdSchema().safeParse(undefined).success).toBe(false);
    });

    it('still rejects a missing cwd at resolve time', () => {
      expect(() => resolveProjectConfig(undefined, baseConfig)).toThrow(/cwd/);
    });

    it('still rejects a non-absolute cwd', () => {
      expect(() => resolveProjectConfig('relative/path', baseConfig)).toThrow(/absolute/);
    });
  });
});
