// Body-level tests for the `formio-react` parent skill and its branch documents.
//
// The layout suite holds the shape; this one holds the content each document
// must carry — the shared preflight, project resolution, the bootstrap
// constraints that keep a generated app runnable, and the branch rules.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-react');

const read = (file: string) => readFileSync(join(skillDir, file), 'utf8');

describe('formio-react carries the shared library obligations', () => {
  const body = () => read('SKILL.md');

  it('checks the preflight at the first tool call, not at activation', () => {
    expect(body()).toContain('when you reach your first Form.io tool call, not when this skill');
  });

  it('offers formio-mcp-setup as the only remedy for missing tools', () => {
    expect(body()).toContain('formio-mcp-setup');
  });

  it('bans working around missing tools, scoped to build-time work', () => {
    expect(body()).toContain('Never work around missing tools');
    expect(body()).toContain('build-time');
    // The ban must not read as forbidding the generated app from calling the API.
    expect(body()).toContain('runtime');
  });

  it('probes project_get with cwd and branches on all three statuses', () => {
    const text = body();
    expect(text).toContain('project_get');
    expect(text).toContain('cwd');
    for (const status of ['ok', 'not-configured', 'base-url-unresolved']) {
      expect(text).toContain(status);
    }
  });

  it('does not shell out for project resolution', () => {
    expect(body()).not.toMatch(/npx .*@formio\/mcp.* project get/);
  });
});

describe('formio-react SETUP', () => {
  const body = () => read('SETUP.md');

  it('captures one absolute workspace root before reading anything', () => {
    expect(body().toLowerCase()).toContain('absolute path');
    expect(body().toLowerCase()).toMatch(/working directory|cd /);
  });

  it('links the canonical URL guidance rather than restating it', () => {
    expect(body()).toContain('project-urls.md');
    // Enumerating URL shapes here is exactly the duplication that drifts.
    expect(body()).not.toContain('https://api.form.io');
  });
});

describe('formio-react BOOTSTRAP', () => {
  const body = () => read('BOOTSTRAP.md');

  it('names Vite, the data-router API, and TypeScript', () => {
    const text = body();
    expect(text).toContain('Vite');
    expect(text).toContain('createBrowserRouter');
    expect(text).toContain('TypeScript');
  });

  it('pins the dependency set and captures resolved versions', () => {
    const text = body();
    expect(text).toContain('@formio/react');
    expect(text).toContain('@formio/js');
    expect(text).toContain('react-router');
    expect(text).toContain('FORMIO_REACT_VERSION');
    expect(text).toContain('FORMIO_JS_VERSION');
  });

  it('states the generated application is client-rendered', () => {
    expect(body().toLowerCase()).toContain('client-rendered');
  });

  // Asserted against the lines that actually SAY "out of scope". Checking only
  // that the two names appear somewhere passes just as well on a document that
  // declares them supported, which is the opposite instruction.
  it('declares server-rendered framework mode and Next.js out of scope', () => {
    const scoped = (body().match(/^.*out of scope.*$/gim) ?? []).join('\n');
    expect(scoped, 'BOOTSTRAP.md must carry an out-of-scope statement').not.toBe('');
    expect(scoped).toContain('framework mode');
    expect(scoped).toContain('Next.js');
  });

  it('installs and imports a renderer stylesheet, distinct from the design language', () => {
    const text = body();
    expect(text.toLowerCase()).toContain('stylesheet');
    expect(text.toLowerCase()).toContain('design language');
  });

  it('leaves StrictMode enabled and refuses removing it as a remedy', () => {
    const text = body();
    expect(text).toContain('StrictMode');
    expect(text.toLowerCase()).toMatch(/not a remedy|is not a remedy/);
  });

  it('stashes the frontend design brief', () => {
    expect(body()).toContain('FRONTEND_DESIGN_BRIEF');
  });
});

describe('formio-react CONFIG', () => {
  const body = () => read('CONFIG.md');

  it('generates src/config.ts and mounts FormioProvider', () => {
    const text = body();
    expect(text).toContain('src/config.ts');
    expect(text).toContain('FormioProvider');
  });

  it('sources both URLs from project_get and hardcodes no example host', () => {
    const text = body();
    expect(text).toContain('project_get');
    expect(text).not.toContain('examples.form.io');
    expect(text).toContain('project-urls.md');
  });

  it('stops and asks when an existing config disagrees with the tools', () => {
    expect(body().toLowerCase()).toContain('disagree');
  });

  it('names the config module as the single source both provider and kernel read', () => {
    expect(body().toLowerCase()).toContain('single source of truth');
  });
});

describe('formio-react AUTH', () => {
  const body = () => read('AUTH.md');

  it('generates public login and register routes with an action submit', () => {
    const text = body();
    expect(text).toContain('/login');
    expect(text).toContain('/register');
    expect(text).toContain('redirect()');
  });

  it('loads the current user in a root loader', () => {
    const text = body();
    expect(text.toLowerCase()).toContain('root route loader');
    expect(text).toContain('useRouteLoaderData');
  });

  it('protects routes with requireUser so no protected screen mounts', () => {
    const text = body();
    expect(text).toContain('requireUser');
    expect(text.toLowerCase()).toContain('never mounts');
  });

  it('forbids the mount-time hook, the isReady flag, and a guard component', () => {
    const text = body();
    expect(text).toContain('No `useUser` hook that fetches after mount');
    expect(text).toContain('isReady');
    expect(text.toLowerCase()).toContain('no guard component');
  });

  it('uses no Redux modules', () => {
    expect(body()).toContain('modules/auth');
    expect(body().toLowerCase()).toContain('legacy redux');
  });

  it('defaults to authentication only, leaving authorization server-side', () => {
    const text = body();
    expect(text.toLowerCase()).toContain('authentication only');
    expect(text).toContain('submissionAccess');
  });
});

describe('formio-react EXISTING', () => {
  const body = () => read('EXISTING.md');

  it('reports the full inspection before modifying anything', () => {
    const text = body().toLowerCase();
    for (const item of ['router style', 'stylesheet', 'provider', 'authentication', 'design']) {
      expect(text).toContain(item);
    }
    expect(text).toMatch(/before modifying|before you modify|before writing/);
  });

  it('never scaffolds and never loads BOOTSTRAP', () => {
    const text = body();
    expect(text).toContain('BOOTSTRAP.md');
    expect(text.toLowerCase()).toMatch(/never runs on this branch|no workspace is scaffolded/);
  });

  it('gates on the data router before any file is written', () => {
    const text = body();
    expect(text).toContain('createBrowserRouter');
    expect(text.toLowerCase()).toContain('before writing any file');
    expect(text.toLowerCase()).toMatch(/never migrate routing|without that explicit approval/);
  });

  it('backfills only what is missing and integrates with what exists', () => {
    const text = body().toLowerCase();
    expect(text).toContain('only what is missing');
    expect(text).toMatch(/integrate with what exists|do not replace it/);
  });

  it('hands off with the branch and the inspection findings', () => {
    const text = body();
    expect(text).toContain("branch: 'existing'");
    expect(text).toContain('formio-react-resources/SKILL.md');
  });
});
