import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormioConfig } from '../config.js';
import { ProjectMapUnreadableError, writeProjectEntry } from '../project-map.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

// One precedence order for every agent: an environment project URL wins, then
// the per-cwd map, then an actionable error. Nothing here reads a host-mode
// variable, so a stale FORMIO_PLUGIN_CONTEXT cannot change any outcome.
describe('resolveProjectConfig', () => {
  const baseConfig: FormioConfig = {
    baseUrl: 'https://api.form.io',
    apiKey: 'abc',
  };

  const configWithEnvProject: FormioConfig = {
    ...baseConfig,
    projectUrl: 'https://from-env.form.io',
  };

  const originalPluginContext = process.env.FORMIO_PLUGIN_CONTEXT;

  beforeEach(() => {
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    if (originalPluginContext === undefined) {
      delete process.env.FORMIO_PLUGIN_CONTEXT;
    } else {
      process.env.FORMIO_PLUGIN_CONTEXT = originalPluginContext;
    }
  });

  describe('environment wins over the project map', () => {
    it('resolves the environment project URL despite a mapped entry for the cwd', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', configWithEnvProject);

      expect(cfg.projectUrl).toBe('https://from-env.form.io');
    });

    // An explicit FORMIO_BASE_URL is part of the pin, so it outranks whatever
    // deployment the mapping names — the pair the launch configuration declared
    // travels together.
    it('keeps the configured base URL when the environment supplies the project', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mysite.com/mapped',
        FORMIO_BASE_URL: 'https://mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', configWithEnvProject);

      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    // A pin supplies a project, not a deployment. A self-hosted user who pins
    // FORMIO_PROJECT_URL in .mcp.json with no FORMIO_BASE_URL, having already
    // mapped that same project with project_set, otherwise had the login built
    // from the api.form.io default — the wrong-deployment login the mapping
    // exists to prevent, and silent because nothing reports which host was used.
    it('uses the mapped base URL when the pin names the mapped project and supplies no base URL', () => {
      writeProjectEntry('/workspace/pkg-pinned', {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-pinned', {
        apiKey: 'abc',
        projectUrl: 'https://myproject.mysite.com/',
      });

      expect(cfg.projectUrl).toBe('https://myproject.mysite.com');
      expect(cfg.baseUrl).toBe('https://forms.mysite.com');
    });

    // The borrow is gated on the two projects being the same one. A base URL
    // belongs to a deployment, not to a directory: lending a self-hosted
    // deployment to a pinned hosted project sends the portal login to the wrong
    // host and caches the token under that host's key — the same silent failure
    // the borrow was added to prevent, reached from the other side.
    it('refuses to lend the mapped base URL to a different pinned project', () => {
      writeProjectEntry('/workspace/pkg-other-project', {
        FORMIO_PROJECT_URL: 'https://proj-a.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-other-project', {
        apiKey: 'abc',
        projectUrl: 'https://examples.form.io',
      });

      expect(cfg.projectUrl).toBe('https://examples.form.io');
      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    it('resolves the environment project URL when no cwd is supplied', () => {
      const cfg = resolveProjectConfig(undefined, configWithEnvProject);

      expect(cfg.projectUrl).toBe('https://from-env.form.io');
    });

    it('strips a trailing slash from the environment project URL', () => {
      const cfg = resolveProjectConfig(undefined, {
        ...baseConfig,
        projectUrl: 'https://from-env.form.io/',
      });

      expect(cfg.projectUrl).toBe('https://from-env.form.io');
    });

    it('is unaffected by a stale FORMIO_PLUGIN_CONTEXT', () => {
      process.env.FORMIO_PLUGIN_CONTEXT = '1';
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', configWithEnvProject);

      expect(cfg.projectUrl).toBe('https://from-env.form.io');
    });
  });

  describe('project map is used when the environment has no project', () => {
    it('resolves the mapped project URL for the cwd', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);

      expect(cfg.projectUrl).toBe('https://mapped.form.io');
      expect(cfg.baseUrl).toBe('https://api.form.io');
      expect(cfg.apiKey).toBe('abc');
    });

    // A host that prompts for an optional project URL and gets no answer passes
    // an empty string, not an absent variable. Read as a pin, it locks the server
    // out of every mapping project_set can write.
    it('falls back to the map when the environment project URL is empty', () => {
      writeProjectEntry('/workspace/pkg-empty-env', {
        FORMIO_PROJECT_URL: 'https://mysite.com/mapped',
        FORMIO_BASE_URL: 'https://mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-empty-env', {
        ...baseConfig,
        projectUrl: '',
      });

      expect(cfg.projectUrl).toBe('https://mysite.com/mapped');
      expect(cfg.baseUrl).toBe('https://mysite.com');
    });

    // project_set falls back to the server's own process cwd when a client omits
    // the argument, so resolution has to look there too. Keying the write and the
    // read differently produced a mapping that reported success and could never
    // be read back: the next tool call said "no project configured", whose remedy
    // is project_set, which writes the same unreadable entry again.
    it('reads the mapping keyed on the process cwd when no cwd is supplied', () => {
      writeProjectEntry(process.cwd(), {
        FORMIO_PROJECT_URL: 'https://server-cwd.form.io',
        FORMIO_BASE_URL: 'https://server-cwd-deployment.example.com',
      });

      const cfg = resolveProjectConfig(undefined, baseConfig);

      expect(cfg.projectUrl).toBe('https://server-cwd.form.io');
      expect(cfg.baseUrl).toBe('https://server-cwd-deployment.example.com');
    });

    it('prefers the mapped base URL over the configured base URL', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mysite.com/mapped',
        FORMIO_BASE_URL: 'https://mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);

      expect(cfg.baseUrl).toBe('https://mysite.com');
      expect(cfg.projectUrl).toBe('https://mysite.com/mapped');
    });

    // A customer deployment can route projects to sibling sub-domains instead of
    // sub-directories, so the mapped project host is not under the mapped base
    // host. Resolution must carry both through untouched — nothing here may
    // reconstruct one URL from the other.
    it('resolves a sub-domain-routed customer project against its own deployment host', () => {
      writeProjectEntry('/workspace/pkg-subdomain', {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-subdomain', baseConfig);

      expect(cfg.projectUrl).toBe('https://myproject.mysite.com');
      expect(cfg.baseUrl).toBe('https://forms.mysite.com');
    });

    it('falls back to the configured base URL when the mapped entry has none', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);

      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    // getConfig leaves baseUrl undefined when the environment supplies none, so
    // the hosted-cloud default is applied here — after the mapping has had its
    // say, which is the whole reason it moved.
    it('defaults to the hosted cloud when neither the mapping nor the config has a base URL', () => {
      writeProjectEntry('/workspace/pkg-no-base', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-no-base', { apiKey: 'abc' });

      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    it('strips a trailing slash from the mapped project URL', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io/',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', baseConfig);

      expect(cfg.projectUrl).toBe('https://mapped.form.io');
    });

    it('reads the map without a FORMIO_PLUGIN_CONTEXT being set', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      expect(resolveProjectConfig('/workspace/pkg-a', baseConfig).projectUrl).toBe(
        'https://mapped.form.io'
      );
    });

    it('does not mutate baseConfig when resolving', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });
      const snapshot = { ...baseConfig };

      resolveProjectConfig('/workspace/pkg-a', baseConfig);

      expect(baseConfig).toEqual(snapshot);
    });
  });

  // A pinned launch must not depend on a file it never reads. The map used to be
  // skipped outright on that path; consulting it for the base URL made a corrupt
  // ~/.formio/projects.json fail every tool call of a server that had been given
  // both URLs explicitly.
  describe('an unreadable project map', () => {
    let cacheDir: string;

    beforeEach(() => {
      cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-resolver-'));
      fs.writeFileSync(path.join(cacheDir, 'projects.json'), 'not json');
      vi.spyOn(process.stderr, 'write').mockImplementation((): boolean => true);
    });

    afterEach(() => {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    it('is never read when the pin carries its own base URL', () => {
      const cfg = resolveProjectConfig(
        '/workspace/pkg-a',
        { projectUrl: 'https://examples.form.io', baseUrl: 'https://api.form.io' },
        { cacheDir }
      );

      expect(cfg.projectUrl).toBe('https://examples.form.io');
      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    // Consulted here, but only as a base-URL fallback: unreadable means "no
    // mapped base URL", the same answer as no mapping, so the pin still resolves.
    it('does not fail a pin that has no base URL of its own', () => {
      const cfg = resolveProjectConfig(
        '/workspace/pkg-a',
        { projectUrl: 'https://examples.form.io' },
        { cacheDir }
      );

      expect(cfg.projectUrl).toBe('https://examples.form.io');
      expect(cfg.baseUrl).toBe('https://api.form.io');
    });

    // Through the caller's sink, not the process stream: the bin's project
    // command returns its whole outcome in a result object, and a note written
    // to stderr from here is the one part of it no caller and no test can see.
    it('reports the skipped map through the caller’s note sink', () => {
      const notes: string[] = [];

      resolveProjectConfig(
        '/workspace/pkg-a',
        { projectUrl: 'https://examples.form.io' },
        { cacheDir, onNote: (message) => notes.push(message) }
      );

      expect(notes.join('\n')).toMatch(/projects\.json/);
      expect(vi.mocked(process.stderr.write)).not.toHaveBeenCalled();
    });

    it('falls back to stderr when the caller supplies no sink', () => {
      resolveProjectConfig(
        '/workspace/pkg-a',
        { projectUrl: 'https://examples.form.io' },
        { cacheDir }
      );

      expect(vi.mocked(process.stderr.write).mock.calls.join('')).toMatch(/projects\.json/);
    });

    // Where the map is the source of the project, the corruption still travels:
    // reporting it as "nothing configured" sends the caller to project_set,
    // whose rewrite is what destroys the surviving mappings.
    it('still fails when the map is what would supply the project', () => {
      expect(() =>
        resolveProjectConfig('/workspace/pkg-a', { apiKey: 'abc' }, { cacheDir })
      ).toThrow(ProjectMapUnreadableError);
    });
  });

  describe('actionable errors when nothing resolves', () => {
    it('names project_set, FORMIO_PROJECT_URL and the searched cwd', () => {
      expect(() => resolveProjectConfig('/workspace/unmapped', baseConfig)).toThrow(/project_set/);
      expect(() => resolveProjectConfig('/workspace/unmapped', baseConfig)).toThrow(
        /FORMIO_PROJECT_URL/
      );
      expect(() => resolveProjectConfig('/workspace/unmapped', baseConfig)).toThrow(
        /\/workspace\/unmapped/
      );
    });

    it('names project_set and FORMIO_PROJECT_URL when no cwd was supplied', () => {
      expect(() => resolveProjectConfig(undefined, baseConfig)).toThrow(/project_set/);
      expect(() => resolveProjectConfig(undefined, baseConfig)).toThrow(/FORMIO_PROJECT_URL/);
    });

    it('rejects a relative cwd', () => {
      expect(() => resolveProjectConfig('packages/a', baseConfig)).toThrow(
        /cwd must be an absolute path/
      );
    });

    it('treats an empty cwd as no cwd rather than an error about cwd itself', () => {
      expect(() => resolveProjectConfig('', baseConfig)).toThrow(/project_set/);
    });
  });
});

describe('cwdSchema', () => {
  const originalPluginContext = process.env.FORMIO_PLUGIN_CONTEXT;

  afterEach(() => {
    if (originalPluginContext === undefined) {
      delete process.env.FORMIO_PLUGIN_CONTEXT;
    } else {
      process.env.FORMIO_PLUGIN_CONTEXT = originalPluginContext;
    }
  });

  it('accepts an absolute path', () => {
    expect(cwdSchema.safeParse('/workspace/pkg-a').success).toBe(true);
  });

  it('accepts omission', () => {
    expect(cwdSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects a relative path', () => {
    expect(cwdSchema.safeParse('packages/a').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(cwdSchema.safeParse('').success).toBe(false);
  });

  it('has one shape regardless of FORMIO_PLUGIN_CONTEXT', () => {
    process.env.FORMIO_PLUGIN_CONTEXT = '1';

    expect(cwdSchema.safeParse(undefined).success).toBe(true);
    expect(cwdSchema.safeParse('packages/a').success).toBe(false);
    expect(cwdSchema.safeParse('/workspace/pkg-a').success).toBe(true);
  });

  it('describes both ways to supply a project', () => {
    expect(cwdSchema.description).toMatch(/project_set/);
    expect(cwdSchema.description).toMatch(/FORMIO_PROJECT_URL/);
  });
});
