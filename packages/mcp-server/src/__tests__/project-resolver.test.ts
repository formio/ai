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

  // Precedence is by scope: a mapping is a statement about this directory, the
  // environment a process-wide default. Both halves of the pair now resolve that
  // way — the base URL always did, and the project URL used to resolve the other
  // direction, so one pair resolved in two.
  describe('the project map wins over the environment', () => {
    it('resolves the mapped project URL despite an environment project URL', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', configWithEnvProject);

      expect(cfg.projectUrl).toBe('https://mapped.form.io');
    });

    // The mapped deployment outranks the environment's for the same reason its
    // project does: it is the more specific statement about this directory.
    it('prefers the mapped base URL over the configured one', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mysite.com/mapped',
        FORMIO_BASE_URL: 'https://mysite.com',
      });

      const cfg = resolveProjectConfig('/workspace/pkg-a', configWithEnvProject);

      expect(cfg.baseUrl).toBe('https://mysite.com');
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

    // The old "refuses to lend the mapped base URL to a different pinned project"
    // guard is deleted rather than rewritten. It existed because a pinned project
    // could differ from the mapped one while the mapped base URL was still
    // consulted; now the mapping's project wins outright, so that combination is
    // unreachable and there is nothing to gate.
    it('resolves the environment project URL when nothing else supplies one', () => {
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

      expect(cfg.projectUrl).toBe('https://mapped.form.io');
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

    // Skipping an unreadable map used to be safe for an environment project URL,
    // because the map was strictly lower precedence for that half. It is not safe
    // now: the map outranks the environment for BOTH halves, so continuing past a
    // file we cannot read could resolve a value the unreadable entry would have
    // overridden — a silent wrong deployment, which is the whole failure class
    // this ordering exists to close.
    it('fails an environment project URL rather than skipping a map it cannot read', () => {
      expect(() =>
        resolveProjectConfig(
          '/workspace/pkg-a',
          { projectUrl: 'https://examples.form.io', baseUrl: 'https://api.form.io' },
          { cacheDir }
        )
      ).toThrow(ProjectMapUnreadableError);
    });

    it('fails an environment project URL with no base URL of its own too', () => {
      expect(() =>
        resolveProjectConfig(
          '/workspace/pkg-a',
          { projectUrl: 'https://examples.form.io' },
          { cacheDir }
        )
      ).toThrow(ProjectMapUnreadableError);
    });

    // Through the caller's sink, not the process stream: the bin's project
    // command returns its whole outcome in a result object, and a note written
    // to stderr from here is the one part of it no caller and no test can see.
    // The one case where skipping is provably safe: a committed file supplying
    // BOTH URLs leaves the map nothing to decide, so an unreadable file cannot
    // change the answer. The reason is still said out loud, because a broken map
    // that nothing depends on today breaks every uncommitted directory tomorrow.
    it('reports the skipped map through the caller’s note sink', () => {
      const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-complete-'));
      fs.mkdirSync(path.join(workspace, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(workspace, 'formio.json'),
        JSON.stringify({
          projectUrl: 'https://examples.form.io',
          baseUrl: 'https://api.form.io',
        })
      );
      const notes: string[] = [];

      const cfg = resolveProjectConfig(
        workspace,
        {},
        {
          cacheDir,
          onNote: (message) => notes.push(message),
        }
      );

      expect(cfg.projectUrl).toBe('https://examples.form.io');
      expect(notes.join('\n')).toMatch(/projects\.json/);
      expect(vi.mocked(process.stderr.write)).not.toHaveBeenCalled();
      fs.rmSync(workspace, { recursive: true, force: true });
    });

    it('falls back to stderr when the caller supplies no sink', () => {
      const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-complete-'));
      fs.mkdirSync(path.join(workspace, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(workspace, 'formio.json'),
        JSON.stringify({
          projectUrl: 'https://examples.form.io',
          baseUrl: 'https://api.form.io',
        })
      );

      resolveProjectConfig(workspace, {}, { cacheDir });

      expect(vi.mocked(process.stderr.write).mock.calls.join('')).toMatch(/projects\.json/);
      fs.rmSync(workspace, { recursive: true, force: true });
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

  // getConfig validates every URL it reads from the environment; mapped values
  // reached fetch unchecked. ~/.formio/projects.json is hand-editable and predates
  // that validation, so a stored "forms.mysite.com" resolved cleanly, was reported
  // as the answer by `project get`, and then died inside fetch as "Failed to parse
  // URL from forms.mysite.com/current" — far from the file that caused it.
  describe('a mapped URL that is not a URL', () => {
    it('fails resolution rather than handing an unparseable base URL to fetch', () => {
      writeProjectEntry('/workspace/pkg-bad-base', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
        FORMIO_BASE_URL: 'forms.mysite.com',
      });

      expect(() => resolveProjectConfig('/workspace/pkg-bad-base', { apiKey: 'abc' })).toThrow(
        ProjectMapUnreadableError
      );
    });

    it('names the variable, the directory and the map file', () => {
      writeProjectEntry('/workspace/pkg-bad-base-named', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
        FORMIO_BASE_URL: 'forms.mysite.com',
      });
      const resolve = () =>
        resolveProjectConfig('/workspace/pkg-bad-base-named', { apiKey: 'abc' });

      expect(resolve).toThrow(/FORMIO_BASE_URL/);
      expect(resolve).toThrow(/pkg-bad-base-named/);
      expect(resolve).toThrow(/projects\.json/);
    });

    it('fails on an unusable mapped project URL', () => {
      writeProjectEntry('/workspace/pkg-bad-project', {
        FORMIO_PROJECT_URL: 'forms.mysite.com/myproject',
      });

      expect(() => resolveProjectConfig('/workspace/pkg-bad-project', { apiKey: 'abc' })).toThrow(
        /FORMIO_PROJECT_URL/
      );
    });

    it('rejects a mapped URL whose protocol is not http or https', () => {
      writeProjectEntry('/workspace/pkg-ftp', {
        FORMIO_PROJECT_URL: 'ftp://mapped.form.io',
      });

      expect(() => resolveProjectConfig('/workspace/pkg-ftp', { apiKey: 'abc' })).toThrow(
        ProjectMapUnreadableError
      );
    });

    // Normalized on the same terms as an environment value: everything downstream
    // compares these strings — the pinned project against the mapped one, the
    // token cache against its key — so surrounding whitespace and host case have
    // to be gone before then.
    it('normalizes a usable mapped URL the way an environment value is normalized', () => {
      writeProjectEntry('/workspace/pkg-untidy', {
        FORMIO_PROJECT_URL: '  https://Mapped.form.io/  ',
      });

      expect(resolveProjectConfig('/workspace/pkg-untidy', { apiKey: 'abc' }).projectUrl).toBe(
        'https://mapped.form.io'
      );
    });

    // A pin that never needed the map must not be failed by it — the same rule an
    // unreadable projects.json already follows. Unusable means "no mapped base
    // URL", which is the answer no mapping at all would have given.
    // Previously this was tolerated: the entry's base URL was only a fallback for
    // a pinned project, so an unusable one degraded to the default. Now the
    // mapping outranks the environment for both halves, so an entry we cannot read
    // could be hiding the value that should have won — and degrading silently to
    // api.form.io is exactly the wrong-deployment failure to avoid.
    it('fails rather than degrading an unusable mapped base URL to the default', () => {
      writeProjectEntry('/workspace/pkg-pin-bad-base', {
        FORMIO_PROJECT_URL: 'https://examples.form.io',
        FORMIO_BASE_URL: 'forms.mysite.com',
      });

      expect(() =>
        resolveProjectConfig('/workspace/pkg-pin-bad-base', {
          projectUrl: 'https://examples.form.io',
        })
      ).toThrow(/FORMIO_BASE_URL/);
    });
  });

  // The server's process cwd is fixed at spawn and, for a plugin- or
  // desktop-launched server, is not where the user is. It stays the fallback —
  // project_set writes there under the same conditions — but a resolution that
  // silently targets a different directory's project is the one failure nothing
  // else in this flow can surface.
  describe('resolving with no cwd argument', () => {
    it('says which directory supplied the mapping', () => {
      writeProjectEntry(process.cwd(), {
        FORMIO_PROJECT_URL: 'https://server-cwd.form.io',
      });
      const notes: string[] = [];

      resolveProjectConfig(undefined, baseConfig, { onNote: (message) => notes.push(message) });

      expect(notes.join('\n')).toContain(process.cwd());
      expect(notes.join('\n')).toMatch(/cwd/);
    });

    it('says nothing when the caller passed a cwd', () => {
      writeProjectEntry('/workspace/pkg-a', {
        FORMIO_PROJECT_URL: 'https://mapped.form.io',
      });
      const notes: string[] = [];

      resolveProjectConfig('/workspace/pkg-a', baseConfig, {
        onNote: (message) => notes.push(message),
      });

      expect(notes).toEqual([]);
    });

    it('says nothing when the environment pinned the project', () => {
      const notes: string[] = [];

      resolveProjectConfig(undefined, configWithEnvProject, {
        onNote: (message) => notes.push(message),
      });

      expect(notes).toEqual([]);
    });

    // Without the directory and the argument in the message, the remedy the error
    // names is project_set — which writes another mapping the next cwd-passing
    // call will not find, and the loop repeats.
    it('names the searched directory and the cwd argument when nothing is mapped there', () => {
      let message = '';
      try {
        resolveProjectConfig(undefined, baseConfig);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain(process.cwd());
      expect(message).toMatch(/cwd/);
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

  // The description is read on every tool call, more reliably than the server's
  // instructions, so it has to carry the SAME precedence the resolver
  // implements. It used to say a FORMIO_PROJECT_URL in the environment "takes
  // precedence over every mapping" and made cwd unnecessary — the pre-reorder
  // model, and now backwards: the environment is the weakest source, so omitting
  // cwd cannot be made safe by setting a variable.
  it('names every source of a project, narrowest scope first', () => {
    expect(cwdSchema.description).toMatch(/project_set/);
    expect(cwdSchema.description).toMatch(/FORMIO_PROJECT_URL/);
    expect(cwdSchema.description).toContain('formio.json');
    expect(cwdSchema.description).toMatch(/weakest/i);
  });

  it('does not claim the environment pins the project or replaces cwd', () => {
    expect(cwdSchema.description).not.toMatch(/\bpins?\b/i);
    expect(cwdSchema.description).not.toMatch(/makes it unnecessary/i);
    expect(cwdSchema.description).not.toMatch(/takes precedence over every mapping/i);
  });
});
