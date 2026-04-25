import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

describe('resolveProjectConfig', () => {
  const baseConfig: FormioConfig = {
    baseUrl: 'https://api.form.io',
    apiKey: 'abc',
  };

  const originalPluginContext = process.env.FORMIO_PLUGIN_CONTEXT;

  beforeEach(() => {
    // Default tests to plugin context so map-reading behavior is exercised;
    // standalone-specific tests override this.
    process.env.FORMIO_PLUGIN_CONTEXT = '1';
  });

  afterEach(() => {
    if (originalPluginContext === undefined) {
      delete process.env.FORMIO_PLUGIN_CONTEXT;
    } else {
      process.env.FORMIO_PLUGIN_CONTEXT = originalPluginContext;
    }
  });

  it('returns config with the project URL mapped for the cwd', () => {
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/mapped',
    });

    const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);

    expect(cfg.projectUrl).toBe('https://api.form.io/mapped');
    expect(cfg.baseUrl).toBe('https://api.form.io');
    expect(cfg.apiKey).toBe('abc');
  });

  it('strips a trailing slash from the mapped project URL', () => {
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/mapped/',
    });

    const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);
    expect(cfg.projectUrl).toBe('https://api.form.io/mapped');
  });

  it('throws when the cwd is not mapped and baseConfig has no projectUrl', () => {
    expect(() => resolveProjectConfig('/workspace/unmapped', baseConfig)).toThrow(
      /No Form\.io project is mapped for cwd=\/workspace\/unmapped/
    );
  });

  it('falls back to baseConfig.projectUrl when the cwd is not mapped (plugin context)', () => {
    const baseWithEnv: FormioConfig = {
      baseUrl: 'https://api.form.io',
      projectUrl: 'https://api.form.io/from-env/',
      apiKey: 'abc',
    };

    const cfg = resolveProjectConfig('/workspace/unmapped', baseWithEnv);

    expect(cfg.projectUrl).toBe('https://api.form.io/from-env');
  });

  it('prefers the mapped cwd URL over baseConfig.projectUrl in plugin context', () => {
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/mapped',
    });
    const baseWithEnv: FormioConfig = {
      baseUrl: 'https://api.form.io',
      projectUrl: 'https://api.form.io/from-env',
      apiKey: 'abc',
    };

    const cfg = resolveProjectConfig('/workspace/pkg-a', baseWithEnv);

    expect(cfg.projectUrl).toBe('https://api.form.io/mapped');
  });

  it('ignores the projects.json map entirely in standalone context — env wins over stale map entry', () => {
    delete process.env.FORMIO_PLUGIN_CONTEXT;
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/stale-plugin-entry',
    });
    const baseWithEnv: FormioConfig = {
      baseUrl: 'https://api.form.io',
      projectUrl: 'https://api.form.io/from-mcp-json',
      apiKey: 'abc',
    };

    const cfg = resolveProjectConfig('/workspace/pkg-a', baseWithEnv);

    expect(cfg.projectUrl).toBe('https://api.form.io/from-mcp-json');
  });

  it('throws in standalone context when map has entry but baseConfig has no projectUrl', () => {
    delete process.env.FORMIO_PLUGIN_CONTEXT;
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/stale-plugin-entry',
    });

    expect(() => resolveProjectConfig('/workspace/pkg-a', baseConfig)).toThrow(
      /No Form\.io project is mapped/
    );
  });

  it('throws when cwd is an empty string', () => {
    expect(() => resolveProjectConfig('', baseConfig)).toThrow(/cwd is required/);
  });

  it('throws when cwd is a relative path', () => {
    expect(() => resolveProjectConfig('packages/a', baseConfig)).toThrow(
      /cwd must be an absolute path/
    );
  });

  it('does not mutate baseConfig when resolving', () => {
    writeProjectEntry('/workspace/pkg-a', {
      FORMIO_PROJECT_URL: 'https://api.form.io/mapped',
    });
    const snapshot = { ...baseConfig };

    resolveProjectConfig('/workspace/pkg-a', baseConfig);

    expect(baseConfig).toEqual(snapshot);
  });
});

describe('cwdSchema', () => {
  it('accepts an absolute path', () => {
    expect(cwdSchema.safeParse('/workspace/pkg-a').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(cwdSchema.safeParse('').success).toBe(false);
  });

  it('rejects a relative path', () => {
    const result = cwdSchema.safeParse('packages/a');
    expect(result.success).toBe(false);
  });
});
