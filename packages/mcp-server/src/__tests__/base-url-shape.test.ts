import { describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { writeProjectEntry } from '../project-map.js';
import { resolveProject, resolveProjectConfig } from '../project-resolver.js';

// The base URL is only ever defaulted to https://api.form.io when the project
// URL says that constant can be right. It builds the portal-login URL and keys
// the JWT cache, so applying it to a customer deployment points both at a host
// the user does not use — and does so silently, which is the failure mode these
// tests exist to make impossible.
describe('shape-aware base URL resolution', () => {
  const noBaseUrl: FormioConfig = { apiKey: undefined };

  function mapProject(cwd: string, projectUrl: string): void {
    writeProjectEntry(cwd, { FORMIO_PROJECT_URL: projectUrl });
  }

  // The VALUE is unchanged and pinned here; only its reported provenance moved.
  // api.form.io is the one deployment whose base URL is a constant, so naming it
  // from a form.io host is a derivation, not a fallback.
  it('derives api.form.io for a form.io-hosted project', () => {
    mapProject('/w/hosted', 'https://examples.form.io');

    const { config, sources } = resolveProject('/w/hosted', noBaseUrl);

    expect(config.baseUrl).toBe('https://api.form.io');
    expect(sources.baseUrl).toBe('derived');
  });

  it('derives the origin for a single-segment sub-directory project', () => {
    mapProject('/w/subdir', 'https://forms.mysite.com/myproject');

    const { config, sources } = resolveProject('/w/subdir', noBaseUrl);

    expect(config.baseUrl).toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('derived');
  });

  // A deployment may be mounted at a sub-path. The project URL is the
  // deployment plus exactly one segment, so the deployment is the project URL's
  // parent — flattening to the origin would point the login and /current at a
  // host root that serves neither.
  it('keeps the parent path for a deployment mounted at a sub-path', () => {
    mapProject('/w/subpath', 'https://forms.mysite.com/one/two');

    const { config, sources } = resolveProject('/w/subpath', noBaseUrl);

    expect(config.baseUrl).toBe('https://forms.mysite.com/one');
    expect(config.baseUrl).not.toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('derived');
  });

  it('derives a local origin including the port', () => {
    mapProject('/w/local', 'http://localhost:3000/authoring-abc123');

    const { config, sources } = resolveProject('/w/local', noBaseUrl);

    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(sources.baseUrl).toBe('derived');
  });

  // Resolution succeeds. baseUrl is read only by the auth path, and an API-key
  // deployment never reads it at all, so throwing here would fail calls that
  // never needed the value.
  it('leaves the base URL unresolved for a path-less non-form.io project', () => {
    mapProject('/w/subdomain', 'https://myproject.mysite.com');

    const { config, sources } = resolveProject('/w/subdomain', noBaseUrl);

    expect(config.projectUrl).toBe('https://myproject.mysite.com');
    expect(config.baseUrl).toBeUndefined();
    expect(sources.baseUrl).toBe('unresolved');
  });

  it('prefers a mapped base URL over the unresolved state', () => {
    writeProjectEntry('/w/mapped-base', {
      FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
      FORMIO_BASE_URL: 'https://forms.mysite.com',
    });

    const { config, sources } = resolveProject('/w/mapped-base', noBaseUrl);

    expect(config.baseUrl).toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('mapping');
  });

  it('prefers an environment base URL over the unresolved state', () => {
    mapProject('/w/env-base', 'https://myproject.mysite.com');

    const { config, sources } = resolveProject('/w/env-base', {
      baseUrl: 'https://forms.mysite.com',
    });

    expect(config.baseUrl).toBe('https://forms.mysite.com');
    expect(sources.baseUrl).toBe('environment');
  });

  // A pin that carries its own base URL never consults the map and never
  // derives; both halves of the launch configuration travel together.
  it('leaves a fully pinned environment pair untouched', () => {
    const cfg = resolveProjectConfig(undefined, {
      projectUrl: 'https://myproject.mysite.com',
      baseUrl: 'https://forms.mysite.com',
    });

    expect(cfg.projectUrl).toBe('https://myproject.mysite.com');
    expect(cfg.baseUrl).toBe('https://forms.mysite.com');
  });
});
