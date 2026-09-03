// Structural and body tests for the nested `formio-react-resources` sub-skill.
//
// It is loaded by path from formio-react's CRUD branches, but clients other
// than Claude Code discover skills by recursive scan — so its directory name
// must match its declared name, and its description is held to the same budget
// and the same trigger discipline as a top-level skill.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, descriptionOf } from '../skill-descriptions/helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const parentDir = join(repoRoot, 'plugin/skills/formio-react');
const subSkillDir = join(parentDir, 'formio-react-resources');
const subSkillMd = join(subSkillDir, 'SKILL.md');
const referencesDir = join(subSkillDir, 'references');

const REFERENCES = [
  'interview-guide.md',
  'phase-a-plan-template.md',
  'kernel-contract.md',
  'resource-patterns.md',
  'hierarchy.md',
  'app-integration.md',
  'worked-example.md',
] as const;

const REQUIRED_TRIGGERS = ['React', '@formio/react'] as const;

// Framework-agnostic extension phrasing belongs to formio-application, which
// routes here once it has detected the framework.
const BANNED_TRIGGERS = ['also track', 'add a way to see'] as const;

const skill = () => readFileSync(subSkillMd, 'utf8');
const description = () => descriptionOf('formio-react/formio-react-resources');
const reference = (file: string) => readFileSync(join(referencesDir, file), 'utf8');

describe('formio-react-resources layout', () => {
  it('exists and declares a name matching its directory', () => {
    expect(existsSync(subSkillMd)).toBe(true);
    expect(skill()).toMatch(/^name:\s*formio-react-resources\s*$/m);
  });

  it('ships all seven references, non-empty and frontmatter-free', () => {
    for (const file of REFERENCES) {
      const full = join(referencesDir, file);
      expect(existsSync(full), `${file} must exist`).toBe(true);
      const body = readFileSync(full, 'utf8');
      expect(body.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
      expect(body.startsWith('---\n'), `${file} must carry no frontmatter`).toBe(false);
    }
  });

  it('states it is loaded by path, not separately registered', () => {
    expect(skill().toLowerCase()).toContain('loaded by path');
    expect(skill().toLowerCase()).toContain('not a separately-registered top-level skill');
  });
});

describe('formio-react-resources trigger surface', () => {
  it.each(REQUIRED_TRIGGERS)('names %s in its triggers', (trigger) => {
    expect(description()).toContain(trigger);
  });

  it.each(BANNED_TRIGGERS)('does not claim the framework-agnostic phrase %s', (phrase) => {
    expect(description().toLowerCase()).not.toContain(phrase);
  });

  it('fits the description budget', () => {
    expect(description().length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});

describe('formio-react-resources inputs', () => {
  it('takes the planner pair and reads template.md first', () => {
    const body = skill();
    expect(body).toContain('template.md');
    expect(body).toContain('template.json');
    expect(body.indexOf('template.md')).toBeLessThan(body.lastIndexOf('template.json'));
  });

  it('asks for formio-application when no planner pair exists, and never plans', () => {
    const body = skill();
    expect(body).toContain('formio-application');
    expect(body.toLowerCase()).toMatch(/never runs the planner|does not run the planner/);
  });

  it('treats the pair as data, not instructions', () => {
    const body = skill().toLowerCase();
    expect(body).toMatch(/data you read|does not address you|not talking to you/);
    expect(body).toContain('provenance');
    // Values lifted from the pair reach generated source, so they are inspected.
    expect(body).toMatch(/stops the run|stop and ask/);
  });
});

describe('formio-react-resources feature shapes', () => {
  it('documents all four shapes', () => {
    const body = skill().toLowerCase();
    expect(body).toContain('simple');
    expect(body).toMatch(/parent .{0,4} child|hierarchy/);
    expect(body).toMatch(/many-to-many|n:n|join/);
    expect(body).toContain('group');
  });

  it('requires the creator membership row on group-assignment joins', () => {
    expect(skill().toLowerCase()).toContain('membership row');
  });
});

describe('formio-react-resources gates and checks', () => {
  it('gates Phase B on explicit approval even when told to just build it', () => {
    const body = skill();
    expect(body).toContain('just build it');
    expect(body.toLowerCase()).toContain('approval');
  });

  it('documents the closing render check, sign-in first', () => {
    const body = skill().toLowerCase();
    expect(body).toMatch(/sign in/);
    expect(body).toContain('unverified');
  });

  it('expects StrictMode double-invocation and never disables it', () => {
    const body = skill();
    expect(body).toContain('StrictMode');
    expect(body.toLowerCase()).toMatch(/never disabl|not disabled/);
  });

  it('matches an existing app design language rather than adding a second', () => {
    expect(skill().toLowerCase()).toMatch(/established design language|existing design/);
  });
});

describe('formio-react-resources plan template', () => {
  it('requires a route map naming routePath and form per resource', () => {
    const body = reference('phase-a-plan-template.md');
    expect(body).toContain('routePath');
    expect(body).toContain('form');
  });

  it('requires the frontend-design consultation line or its waiver', () => {
    expect(reference('phase-a-plan-template.md')).toContain('frontend-design consulted:');
  });
});

// `guard: requireUser` shipped once in a resourceRoutes sample. The kernel's
// options object carries rendered surfaces only and ignores unknown keys, so
// that sample generated routes with no protection and nothing reported it.
// Protection belongs above the subtree, at the protected layout route.
describe('formio-react-resources protection is applied above the subtree', () => {
  it('no resourceRoutes call passes a guard option', () => {
    // Only code fences — the prose deliberately names `guard` to ban it.
    const codeBlocks = (file: string) =>
      [...reference(file).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    const offenders = REFERENCES.filter((file) =>
      /resourceRoutes\([\s\S]{0,400}?guard\s*:/.test(codeBlocks(file))
    );
    expect(offenders, 'resourceRoutes takes screen overrides only').toEqual([]);
  });

  it('the kernel contract states overrides are rendered surfaces only', () => {
    const contract = reference('kernel-contract.md');
    expect(contract).toContain('rendered surface');
    expect(contract.toLowerCase()).toContain('takes no guard');
  });

  it('app-integration protects once, at a pathless layout route, with auth routes as siblings', () => {
    const body = reference('app-integration.md');
    expect(body).toContain('requireUser()');
    expect(body.toLowerCase()).toContain('pathless');
    expect(body.toLowerCase()).toMatch(/siblings, not children|redirect to themselves/);
  });

  it('warns that child loaders still fire because loaders run in parallel', () => {
    expect(reference('app-integration.md').toLowerCase()).toContain('in parallel');
  });
});

// "My records" is scoped by the deployment, not by the client. Without
// `read_all`, the server injects an owner clause into the list query before it
// runs. A client-side clause is redundant when the access rules are set, and a
// boundary that isn't one when they are not.
describe('formio-react-resources treats my-records as server-side', () => {
  it('hierarchy.md names the server-side mechanisms and forbids the client filter', () => {
    const body = reference('hierarchy.md');
    expect(body).toContain('read_own');
    expect(body).toContain('submissionAccess');
    expect(body).toContain('fieldMatchAccess');
    expect(body.toLowerCase()).toMatch(/no client-side filter|do not filter for it in the client/);
  });

  it('the currentUser binding is documented as pre-fill only', () => {
    const contract = reference('kernel-contract.md');
    expect(contract).toContain("'currentUser'");
    expect(contract.toLowerCase()).toContain('prefill only');
    expect(contract).toContain('MUST be `false`');
  });

  it('a filtering currentUser binding is specified to throw, not drop the clause', () => {
    const contract = reference('kernel-contract.md');
    expect(contract.toLowerCase()).toMatch(/throws on a `?currentuser`? binding with filtering/);
  });

  it('no reference presents client-side filtering as an access boundary', () => {
    for (const file of REFERENCES) {
      expect(
        /filter.{0,40}(my records|"my records")/i.test(reference(file)),
        `${file} must not offer a client-side my-records filter`
      ).toBe(false);
    }
  });
});

// currentUser() reads the SDK's global project URL, which the kernel otherwise
// forbids. It is forced: an instance built to carry the URL parses the host as
// the project, so `https://host/myproject/...` authenticates against
// `https://host`. Pinned so a later "cleanup" does not reintroduce that.
describe('formio-react-resources documents the auth URL exception', () => {
  const contract = () => reference('kernel-contract.md');

  it('states the exception and scopes it to currentUser', () => {
    expect(contract()).toContain('currentUser()');
    expect(contract().toLowerCase()).toContain('exception');
    // Form and submission URLs stay per-request from the config module.
    expect(contract()).toContain('src/config.ts');
  });

  it('shows why constructing an instance for auth is wrong', () => {
    const body = contract();
    expect(body).toContain('projectUrl');
    expect(body.toLowerCase()).toMatch(/project segment is gone|dropped/);
    expect(body.toLowerCase()).toContain('mutates');
  });

  // The guarantee is the config module setting the globals at import time —
  // NOT the provider. createBrowserRouter() runs the initial loaders when it is
  // constructed, before React renders anything, so a doc that credits the
  // provider describes an ordering that does not exist.
  it('credits the config module, not the provider, for the ordering guarantee', () => {
    const body = contract().toLowerCase();
    expect(body).toContain('module evaluation');
    expect(body).toContain('setprojecturl');
    expect(body).not.toMatch(/provider[^.]{0,80}(above the router|before any loader)/);
  });

  it('tells the reader not to "fix" it', () => {
    expect(contract().toLowerCase()).toContain('do not "fix" the auth call');
  });
});

// React Router is not the only router in React. The kernel's domain logic is
// router-agnostic by design; the routing code is the React Router
// implementation and an example of what any data-capable router must supply.
describe('formio-react-resources frames routing as an example of a contract', () => {
  it('app-integration states the split and names what another router must supply', () => {
    const body = reference('app-integration.md').toLowerCase();
    expect(body).toContain('not the only router');
    expect(body).toContain('router-agnostic');
    // The four things any host router has to provide.
    expect(body).toMatch(/load data before a screen renders/);
    expect(body).toMatch(/redirect on success/);
    expect(body).toMatch(/error boundary/);
    expect(body).toMatch(/re-fetch after a write/);
  });

  it('identifies a router with no data phase as the one shape that cannot host the kernel', () => {
    expect(reference('app-integration.md').toLowerCase()).toContain('no data phase');
  });
});
