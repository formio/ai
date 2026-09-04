// Flow contracts for the `formio-angular` skill family.
//
// These lock the defects three independent flow audits found by walking the skill
// as an agent would: not prose problems, but places where a following agent
// stalls, is told two different things, or is asked to use a value nothing
// produced. Each describe block names the scenario that exposed it, because the
// assertion alone does not explain why the rule exists.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const angularRoot = join(repoRoot, 'plugin/skills/formio-angular');

const doc = (rel: string) => readFileSync(join(angularRoot, rel), 'utf8');

function everyMarkdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return everyMarkdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

const allDocs = () =>
  everyMarkdownUnder(angularRoot).map((path) => ({
    path: relative(angularRoot, path),
    body: readFileSync(path, 'utf8'),
  }));

function offenders(predicate: (body: string) => boolean): string[] {
  return allDocs()
    .filter(({ body }) => predicate(body))
    .map(({ path }) => path);
}

// An agent told "you named Angular, so keep going" walks five phases — a skills
// install, `ng new`, four package installs, and edits to angular.json,
// app-module.ts, config.ts and formio.json — before AUTH discovers there is no
// data model. The bail-out has to fire at pre-flight, and it cannot be gated on
// the user NOT having said "Angular", because saying "Angular" is what routed
// them here.
describe('the missing-plan path bails out before it writes anything', () => {
  it('does not require the absence of Angular phrasing to route upstream', () => {
    expect(doc('SKILL.md')).not.toContain('NO explicit Angular phrasing');
  });

  it('pre-flight has a branch for neither planner artifact being present', () => {
    const body = doc('SKILL.md');
    expect(body).toMatch(/neither `template\.md` nor `template\.json`/);
  });

  it('the empty-directory announcement does not promise phases that cannot run', () => {
    // It may name the phases; it may not promise them unconditionally when the
    // prerequisite has not been established.
    const body = doc('SKILL.md');
    expect(body).toMatch(/before BOOTSTRAP|before anything is scaffolded|stop here/i);
  });

  // Three places say this skill never plans. Two used to say to run the planner.
  it('no phase document instructs running the planner itself', () => {
    expect(offenders((body) => /\*\*Run `formio-resource-planner` first\*\*/.test(body))).toEqual(
      []
    );
    expect(
      offenders((body) => /If `formio-resource-planner` has not run yet, run it first/.test(body))
    ).toEqual([]);
  });

  it('the no-plan remedy names the orchestrator that owns planning and import', () => {
    for (const rel of ['AUTH.md', 'formio-angular-resources/SKILL.md']) {
      expect(doc(rel), rel).toContain('formio-application');
    }
  });
});

// BOOTSTRAP self-skips on every existing-workspace scenario, and its skip rule
// carried only PACKAGE_MANAGER forward. Step 7d's FRONTEND_DESIGN_BRIEF is
// required by AUTH, by the resources sub-skill, and by the Phase A gate, which
// makes the agent attest that it was passed.
describe('the design brief exists on every path that consumes it', () => {
  it('the skip rule keeps Step 7 as well as the package manager', () => {
    const skip = doc('BOOTSTRAP.md').split('## Step 1')[0];
    expect(skip).toContain('PACKAGE_MANAGER');
    expect(skip).toMatch(/Step 7/);
  });

  it('the brief is produced whether or not a design skill is available', () => {
    // The old wording produced it only in the "no design skill" branch, which is
    // the branch that fires least often.
    expect(doc('SKILL.md')).not.toMatch(/If none is, follow \[`BOOTSTRAP\.md`\]/);
  });

  it('Step 7d says where its values come from when Step 1 did not run', () => {
    const body = doc('BOOTSTRAP.md');
    const step7d = body.slice(body.indexOf('### 7d.'));
    expect(step7d).toMatch(/skipped|read (it|them) off the workspace|already present/i);
  });
});

// The auth wiring follows what Form.io's own applications ship (formmanager,
// pro.formview.io): FormioAuthService and FormioAuthConfig provided at the
// application ROOT, and auth.module.ts reached ONLY through the /auth
// loadChildren route.
//
// The earlier shape exported an AuthConfig const from auth.module.ts and put
// AuthModule in AppModule.imports. That is a real bug, not a style choice:
// FormioAuth declares no providers and no exports, so the eager import gains
// nothing, while its RouterModule.forChild(FormioAuthRoutes()) contributes a
// SECOND root-level `path: ''` route — and the static import of the module for
// its AuthConfig export kept the "lazy" chunk in the eager graph.
describe('auth is wired the way the shipped Form.io applications wire it', () => {
  // Matched as a bare array ELEMENT (`    AuthModule,` on its own line), which is
  // the shape the defect took. Prose that names it in order to forbid it — and the
  // template comment saying it is deliberately absent — must not trip this.
  it('AuthModule is never placed in an imports array', () => {
    const asArrayElement = /^\s*AuthModule,?\s*$/m;
    expect(
      offenders((body) => asArrayElement.test(body)),
      'AuthModule belongs only as the /auth loadChildren target'
    ).toEqual([]);
  });

  it('nothing statically imports the auth module outside a prohibition', () => {
    const offending = allDocs().filter(({ body }) =>
      body
        .split('\n')
        .some(
          (line) =>
            /^\s*import\s+\{[^}]*\}\s+from\s+'\.\/auth\/auth\.module'/.test(line) &&
            !/never|not|NOT/.test(line)
        )
    );
    expect(offending.map(({ path }) => path)).toEqual([]);
  });

  it('no document exports an AuthConfig const from the auth module', () => {
    expect(offenders((body) => /export const AuthConfig/.test(body))).toEqual([]);
  });

  it('AUTH provides both auth symbols at the root instead', () => {
    const body = doc('AUTH.md');
    expect(body).toMatch(/provide: FormioAuthConfig,\s*\n?\s*useValue:/);
    expect(body).toContain('FormioAuthService,');
  });

  it('AUTH explains why the eager import is wrong, not just that it is', () => {
    const body = doc('AUTH.md');
    expect(body).toMatch(/Why `AuthModule` is NOT in `AppModule.imports`/);
    expect(body.toLowerCase()).toMatch(/no `?providers`?|declares no providers/);
    expect(body).toMatch(/path: ''/);
  });

  it('cites the applications the pattern comes from', () => {
    const body = doc('AUTH.md');
    expect(body).toContain('formmanager');
    expect(body).toContain('pro.formview.io');
  });

  it('nothing plans the auth config into the CONFIG phase file', () => {
    const intoAppConfig =
      /FormioAuthConfig[^\n]{0,40}src\/app\/config\.ts|src\/app\/config\.ts[^\n]{0,40}FormioAuthConfig/;
    expect(offenders((body) => intoAppConfig.test(body))).toEqual([]);
  });
});

// AUTH mandates `path: 'auth'` and warns that changing it silently breaks the
// logout redirect. The Phase A plan template — the thing the USER approves —
// described the login route as `/login`.
describe('the login route is /auth/login everywhere', () => {
  it('no document presents /login as the login route', () => {
    const bad = /(?:route|→|\|)\s*`?\/login`?(?!\/)/;
    expect(offenders((body) => bad.test(body))).toEqual([]);
  });

  it('no document offers /login and /register as top-level routes', () => {
    expect(offenders((body) => /top-level routes\?/.test(body) && /`\/login`/.test(body))).toEqual(
      []
    );
  });

  it('AUTH keeps its warning about changing the path', () => {
    expect(doc('AUTH.md')).toMatch(/Keep `path: 'auth'` exactly/);
  });
});

// The config-mismatch case is described in several documents and every one said
// "ask which is correct". One of the two answers the user can give — "the app is
// right, the mapping is wrong" — had no documented action, and CONFIG's own
// remedy re-read the same unchanged mapping.
describe('a config mismatch has an action for both answers', () => {
  it('SETUP names the recording fix for the app-is-right answer', () => {
    const body = doc('SETUP.md');
    const section = body.slice(body.indexOf('When an existing config.ts disagrees'));
    expect(section).toContain('project_set');
    expect(section).toMatch(/formio\.json/);
  });

  it('CONFIG does not offer re-running SETUP as the fix', () => {
    expect(doc('CONFIG.md')).not.toMatch(/re-run SETUP to match/);
  });

  it('CONFIG does not claim to be the only place this happens', () => {
    expect(doc('CONFIG.md')).not.toMatch(/the one place in the orchestrator/);
  });
});

// Every downstream phase edits src/app/app-module.ts, and nothing ever asked the
// scaffolder for an NgModule workspace. A current `ng new` produces app.config.ts
// instead, and Step 4's three exits were retry, switch workspace, or abort.
describe('BOOTSTRAP handles whichever bootstrap shape the scaffolder produced', () => {
  it('Step 4 recognises the standalone shape rather than only failing on it', () => {
    const body = doc('BOOTSTRAP.md');
    expect(body).toMatch(/app\.config\.ts/);
  });

  it('BOOTSTRAP owns the conversion the later phases assume', () => {
    expect(doc('BOOTSTRAP.md')).toMatch(/bootstrapModule|convert(ing)? (it|the workspace)/i);
  });
});

describe('phase documents do not misdescribe when writing starts', () => {
  it('SETUP does not claim CONFIG is the first phase to touch the disk', () => {
    expect(doc('SETUP.md')).not.toMatch(/CONFIG is the first phase that touches the disk/);
  });

  it('BOOTSTRAP does not claim all its destructive work is gated elsewhere', () => {
    expect(doc('BOOTSTRAP.md')).not.toMatch(
      /the destructive work \(creating files in the workspace\) is gated inside `angular-new-app` itself/
    );
  });
});

describe('every value a later phase consumes is stashed by the phase that has it', () => {
  it('SETUP stashes baseUrlSource, which CONFIG reads', () => {
    expect(doc('CONFIG.md')).toContain('baseUrlSource');
    expect(doc('SETUP.md')).toContain('baseUrlSource');
  });
});

// The parent's handoff section and the sub-skill's expected-inputs list are two
// halves of one contract. They disagreed on four fields, including both of the
// extend path's scoping signals.
describe('the resources handoff contract agrees with itself', () => {
  const expectedInputs = () => {
    const body = doc('formio-angular-resources/SKILL.md');
    const start = body.indexOf('- `workspacePath`');
    const block = body.slice(start, body.indexOf('\n\n', start));
    return [...block.matchAll(/^- `([A-Za-z]+)`/gm)].map((match) => match[1]);
  };

  const handoffSection = () => {
    const body = doc('SKILL.md');
    const start = body.indexOf('## Handoff contract with the Resources sub-skill');
    return body.slice(start, body.indexOf('\n## ', start + 10));
  };

  it('finds both halves', () => {
    expect(expectedInputs().length).toBeGreaterThanOrEqual(5);
    expect(handoffSection().length).toBeGreaterThan(200);
  });

  it('the parent names every field the sub-skill expects', () => {
    const section = handoffSection();
    const missing = expectedInputs().filter((field) => !section.includes(field));
    expect(missing, `parent handoff omits: ${missing.join(', ')}`).toEqual([]);
  });

  it('the parent does not pass URLs the sub-skill says are not in the payload', () => {
    const section = handoffSection();
    expect(section).not.toMatch(/`appUrl`, `apiUrl`/);
    expect(section).toMatch(/project_get|resolve(s)? (them|the URLs)/);
  });
});

// The workspaceRoot rule is stated once and repeated in every document that runs
// a command or writes a file — except the two that write the most.
describe('the workspaceRoot discipline reaches the documents that write files', () => {
  it.each([
    'formio-angular-resources/SKILL.md',
    'formio-angular-resources/references/resource-module-patterns.md',
  ])('%s names workspaceRoot', (rel) => {
    expect(doc(rel)).toContain('workspaceRoot');
  });

  it('no document runs a bare ng build or ng serve', () => {
    // Every shell line must carry its own directory, because a cd earlier in the
    // session retargets it silently.
    // Any line of a fenced block, not just the first: a bare `ng serve` on line
    // two of a multi-command fence is the same hazard and used to pass.
    const bare = /^\s*(?:ng|npx ng) (?:build|serve)\b/m;
    const inFence = (body: string) =>
      [...body.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)].some((m) => bare.test(m[1]));
    expect(offenders(inFence)).toEqual([]);
  });
});

// The embed branch runs none of BOOTSTRAP, which is the only place the SDK gets
// installed — and one of its references said no setup was needed at all.
describe('the embed branch establishes its own prerequisites', () => {
  const embed = (rel: string) => doc(join('formio-angular-form', rel));

  it('SKILL.md checks for the packages and installs them when absent', () => {
    const body = embed('SKILL.md');
    expect(body).toContain('@formio/js');
    expect(body).toMatch(/package\.json/);
    expect(body.toLowerCase()).toMatch(/install/);
  });

  it('it carries the lockfile warning, since the workspace is somebody else’s', () => {
    expect(embed('SKILL.md').toLowerCase()).toMatch(/lockfile/);
  });

  it('environments.md no longer says a working workspace needs nothing extra', () => {
    expect(embed('references/environments.md')).not.toMatch(/needs nothing extra to render a form/);
  });

  it('it says how to find the form URL it calls its only input', () => {
    expect(embed('SKILL.md')).toContain('form_list');
  });

  it('at least one document shows the component being imported', () => {
    const shown = ['references/mounting.md', 'references/control.md'].some((rel) =>
      embed(rel).includes("import { FormioComponent } from '@formio/angular'")
    );
    expect(
      shown,
      'no reference shows the import, so auto-import can resolve the closed subpath'
    ).toBe(true);
  });
});

// styling.md was rewritten for the one-component world and closed every place to
// put the renderer stylesheet — while renderer-directly.md requires adding it.
describe('the direct-renderer path has somewhere to put the stylesheet', () => {
  const embed = (rel: string) => doc(join('formio-angular-form', rel));

  it('styling.md carries an explicit exception for the direct-renderer path', () => {
    const body = embed('references/styling.md');
    expect(body).toMatch(/renderer-directly\.md/);
    expect(body).toMatch(/formio\.form\.css/);
  });

  it('its install-diagnostic does not misfire on a page that dropped the wrapper', () => {
    const body = embed('references/styling.md');
    const line = body.split('\n').find((text) => text.includes('suspect the `@formio/angular`'));
    expect(line ?? '', 'the diagnostic must be scoped to the component path').toMatch(
      /`<formio>`|component path|when you are using/
    );
  });

  it('mounting.md does not attribute nosubmit only to the binding', () => {
    // The component sets nosubmit unconditionally in setForm; the binding decides
    // who SAVES, which is a different statement.
    expect(embed('references/mounting.md')).not.toMatch(
      /`\[url\]` sets the instance URL and sets `nosubmit`/
    );
  });
});

describe('the two branches are distinguishable at the entry point', () => {
  it('the workspace-inspection pre-flight is marked as application-branch only', () => {
    const body = doc('SKILL.md');
    const start = body.indexOf('## Pre-flight (workspace inspection)');
    const heading = body.slice(start, start + 400);
    expect(heading.toLowerCase()).toMatch(/application branch|embed branch (runs|does) not/);
  });

  it('does not claim the two branches share one preflight without saying which', () => {
    expect(doc('SKILL.md')).not.toMatch(/they share a preflight and very little else/);
  });

  it('the thinner-mounting pointer does not promise what renderer-directly refuses', () => {
    expect(doc('formio-angular-form/SKILL.md')).not.toMatch(
      /Where a genuinely thinner mounting is wanted/
    );
  });
});

// `FormioAuth` is imports-only: it brings the auth components into scope and
// contributes no routes. The URLs come from mounting FormioAuthRoutes(). One
// document showed an auth module that imported FormioAuth, mounted
// RouterModule.forChild with only a redirect and a logout route, and carried a
// comment claiming FormioAuth supplied login and register — so the generated
// app's /auth/login resolved to nothing, which is the exact failure AUTH.md
// warns about two documents away.
describe('an auth module that routes actually mounts the routes', () => {
  it('every example importing FormioAuth with forChild also calls FormioAuthRoutes()', () => {
    const offending = allDocs().filter(({ body }) => {
      const blocks = [...body.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((m) => m[1]);
      return blocks.some(
        (code) =>
          /\bFormioAuth\b/.test(code) &&
          /RouterModule\.forChild/.test(code) &&
          !/FormioAuthRoutes\(/.test(code)
      );
    });
    expect(
      offending.map(({ path }) => path),
      'importing FormioAuth does not map any URL — mount FormioAuthRoutes() or /auth/login is dead'
    ).toEqual([]);
  });

  it('no document claims FormioAuth contributes routes on its own', () => {
    expect(
      offenders((body) =>
        /`?FormioAuth`?[^\n]{0,80}contributes the [^\n]{0,40}routes automatically/.test(body)
      )
    ).toEqual([]);
  });
});

// The parent skill summarises each phase in its own words, and those summaries
// went stale when AUTH.md was rewritten: Phase 4 still told the agent to
// configure FormioAuthConfig inside auth.module.ts and import AuthModule into
// AppModule — the exact wiring AUTH.md now calls a defect. An agent reading the
// phase table before opening the phase document produces the bug the rewrite
// removed. The earlier guards missed it because they matched code shapes and a
// single deleted sentence, and a summary is prose.
describe('the parent phase summaries agree with the phase documents', () => {
  const parent = () => doc('SKILL.md');

  it('does not describe importing AuthModule into AppModule', () => {
    expect(parent()).not.toMatch(/import `?AuthModule`? into `?AppModule`?/i);
  });

  it('does not treat an existing AuthModule import as a skip signal', () => {
    const body = parent();
    const claimsSkip =
      /inspect [^.]*for an existing `AuthModule`[^.]*\. If the phase's output already matches/i;
    expect(claimsSkip.test(body)).toBe(false);
  });

  it('offers no planner run in any phase summary', () => {
    expect(parent()).not.toMatch(/run the planner, or skip/i);
  });

  // Scoped to the phase summary itself, NOT through the handoff contract that
  // follows it — that section names `appUrl` in order to forbid passing it.
  it('does not tell Phase 5 to hand over the URLs', () => {
    const body = parent();
    const phase5 = body.slice(body.indexOf('## Phase 5'), body.indexOf('## Handoff contract'));
    expect(phase5).not.toMatch(/`AppConfig` values|appUrl/);
  });
});
