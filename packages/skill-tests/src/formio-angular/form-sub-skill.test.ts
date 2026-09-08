// The `formio-angular-form` embedding sub-skill.
//
// Scope is mounting and wiring only: everything that lives in the form
// DEFINITION stays owned by formio-form and is reached by link, because that
// content is identical whatever renders the form.
//
// ONE Angular component, deliberately. `@formio/angular` publishes
// `FormioComponent` and `@formio/angular/embed` publishes a second one under the
// same element name, and the skill used to make an agent choose between them.
// That choice is now closed, for a reason no amount of documentation fixed: its
// correct answer depends on whether the application will LATER pull in
// `FormioResource` — whose own screens are hardwired to the wrapper through their
// standalone `imports` and depend on reactive inputs (`[refresh]`, `[error]`,
// `[success]`, and a `[form]` that arrives after `ngAfterViewInit`) that the thin
// adapter does not have. An agent embedding a form today cannot see that future,
// so it would guess, and never learn it guessed wrong.
//
// The thin adapter is also a strict SUBSET: it has no capability the wrapper
// lacks, and costs four obligations (teardown, input changes, the zone bridge, a
// submit latch) the reader must remember every time. The second path is now
// `Formio.createForm` in a component — honestly labelled as leaving the framework
// wrapper rather than masquerading as a component preference — and those four
// obligations became the stated price of taking it.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, descriptionOf } from '../skill-descriptions/helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const parentMd = join(repoRoot, 'plugin/skills/formio-angular/SKILL.md');
const subSkillDir = join(repoRoot, 'plugin/skills/formio-angular/formio-angular-form');
const subSkillMd = join(subSkillDir, 'SKILL.md');
const formSkillMd = join(repoRoot, 'plugin/skills/formio-form/SKILL.md');

const REFERENCES = [
  'mounting.md',
  'control.md',
  'lifecycle.md',
  'change-detection.md',
  'config.md',
  'environments.md',
  'styling.md',
  'renderer-directly.md',
] as const;

// Definition-level behaviour has exactly one home. A second copy is a copy that drifts.
const DEFINITION_TOPICS = [
  'calculateValue',
  'validate.json',
  'JSON Logic',
  'cascading select',
] as const;

const skill = () => readFileSync(subSkillMd, 'utf8');
const reference = (file: string) => readFileSync(join(subSkillDir, 'references', file), 'utf8');
const allReferences = () => REFERENCES.map((file) => reference(file)).join('\n');

describe('formio-angular-form layout and triggers', () => {
  it('exists with a name matching its directory', () => {
    expect(existsSync(subSkillMd)).toBe(true);
    expect(skill()).toMatch(/^name:\s*formio-angular-form\s*$/m);
  });

  it('ships all eight references, non-empty and frontmatter-free', () => {
    for (const file of REFERENCES) {
      const full = join(subSkillDir, 'references', file);
      expect(existsSync(full), `${file} must exist`).toBe(true);
      const body = readFileSync(full, 'utf8');
      expect(body.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
      expect(body.startsWith('---\n')).toBe(false);
    }
  });

  it('ships no component-choice reference', () => {
    expect(existsSync(join(subSkillDir, 'references/choosing.md'))).toBe(false);
  });

  it('claims Angular-named embed triggers only', () => {
    const description = descriptionOf('formio-angular/formio-angular-form');
    expect(description).toContain('Angular');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    for (const sibling of ['formio-form', 'formio-angular-resources', 'formio-form-builder']) {
      expect(description).toContain(sibling);
    }
  });

  it('does not advertise a component choice in its description', () => {
    const description = descriptionOf('formio-angular/formio-angular-form');
    expect(description).not.toContain('@formio/angular/embed');
    expect(description.toLowerCase()).not.toMatch(/choos|which component/);
  });

  it('states it is loaded by path and does not activate on its own', () => {
    const body = skill().toLowerCase();
    expect(body).toContain('loaded by path');
    expect(body).toContain('not a separately-registered top-level skill');
  });
});

describe('formio-angular-form scope boundary', () => {
  it.each(DEFINITION_TOPICS)('does not document %s', (topic) => {
    // Naming the topic while routing away is fine; documenting it is not.
    const offenders = REFERENCES.filter((file) => {
      const body = reference(file);
      return body.includes(topic) && !body.includes('formio-form');
    });
    expect(offenders, `${topic} must route to formio-form, not be documented here`).toEqual([]);
  });

  it('links to formio-form for definition behaviour', () => {
    expect(skill()).toContain('formio-form');
  });
});

// One component, and the alternative entry point is not named at all.
//
// This block once asserted the opposite — that the skill named
// `@formio/angular/embed` and argued against it. Omission is stronger, and it is
// the library's existing precedent (see the ReactComponent guard in the React
// tree): a section explaining why not to use something puts it in front of a
// reader who would otherwise never meet it, and hands them a rationale to argue
// with. Nothing routes an agent to that subpath, so silence is sufficient.
describe('one Angular component, named without an alternative', () => {
  it('names `@formio/angular` as the component to use', () => {
    expect(skill()).toMatch(/`@formio\/angular`/);
    expect(skill()).toContain('FormioComponent');
  });

  it('never names the other entry point anywhere in the Angular skill tree', () => {
    const tree = join(repoRoot, 'plugin/skills/formio-angular');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
      );
    const offenders = walk(tree)
      .filter((file) => readFileSync(file, 'utf8').includes('@formio/angular/embed'))
      .map((file) => file.slice(tree.length + 1));
    expect(offenders, 'naming it reintroduces the option the skill exists to settle').toEqual([]);
  });

  it('carries no wrapper-versus-adapter framing anywhere', () => {
    const body = skill() + allReferences();
    expect(body.toLowerCase()).not.toContain('thin adapter');
    expect(body.toLowerCase()).not.toMatch(/the wrapper\b/);
  });

  // Still routes a request for something leaner, without naming a component.
  it('answers a "leaner option" request on the component itself', () => {
    const body = skill() + reference('renderer-directly.md');
    expect(body).toMatch(/disableAlerts|hideLoading/);
  });

  // The one case that genuinely leaves the component behind stays documented.
  it('keeps the renderer-directly path as the only second path', () => {
    expect(skill()).toContain('renderer-directly.md');
  });
});

describe('formio-angular-form mounting', () => {
  it('documents who saves the submission, keyed on src versus url', () => {
    const body = reference('mounting.md');
    expect(body).toMatch(/\[src\]/);
    expect(body).toMatch(/\[url\]/);
    expect(body.toLowerCase()).toMatch(/nosubmit/);
    expect(body.toLowerCase()).toMatch(/save|post/);
  });

  it('routes renderer options through renderOptions, not options', () => {
    const body = reference('mounting.md');
    expect(body).toContain('renderOptions');
    expect(body.toLowerCase()).toMatch(/whitelist|only.{0,60}forward|silently dropped/);
  });

  it('separates the two beforeSubmit hook channels', () => {
    const body = reference('mounting.md');
    expect(body).toContain('beforeSubmit');
    expect(body).toContain('[hooks]');
  });

  it('states the embed is display-agnostic and drives wizards from the instance', () => {
    const body = reference('mounting.md');
    expect(body.toLowerCase()).toContain('agnostic');
    expect(body).toContain('buttonSettings');
    expect(body).toContain('nextPage()');
    expect(body).toContain('prevPage()');
  });

  it('links the page API to formio-form rather than restating it', () => {
    expect(reference('mounting.md')).toContain('formio-form/references/wizards.md');
  });
});

describe('formio-angular-form control', () => {
  it('warns that (ready) emits the component, not the renderer instance', () => {
    const body = reference('control.md');
    expect(body).toContain('formioReady');
    expect(body).toMatch(/component\.formio|\.formio\b/);
  });

  it('names the output surface and the EventEmitter inputs', () => {
    const body = reference('control.md');
    expect(body).toContain('refresh');
    expect(body).toContain('customEvent');
    expect(body).toContain('submitDone');
  });

  it('gives instance.on as the escape hatch for events with no output', () => {
    expect(reference('control.md')).toMatch(/\.on\(/);
  });
});

describe('formio-angular-form lifecycle guidance', () => {
  it('puts actionable guidance before internals, and labels the internals', () => {
    const body = reference('lifecycle.md');
    const actionable = body.toLowerCase().indexOf('# part one');
    const internals = body.toLowerCase().indexOf('# part two');
    expect(actionable).toBeGreaterThan(-1);
    expect(internals).toBeGreaterThan(actionable);
  });

  it('states that a new [form] object identity rebuilds the renderer', () => {
    const body = reference('lifecycle.md');
    expect(body).toContain('ngOnChanges');
    expect(body.toLowerCase()).toMatch(/identity/);
    expect(body.toLowerCase()).toMatch(/not a library defect/);
  });

  it('states that changing [submission] is cheap', () => {
    expect(reference('lifecycle.md').toLowerCase()).toMatch(/submission.{0,160}live instance/s);
  });

  it('warns that noeval is a global switch', () => {
    const body = reference('lifecycle.md');
    expect(body).toContain('noeval');
    expect(body.toLowerCase()).toMatch(/global/);
  });

  it('requires cloning reused form definitions', () => {
    expect(reference('lifecycle.md').toLowerCase()).toMatch(/clone/);
  });

  it('credits the component with the teardown and the submit latch', () => {
    const body = reference('lifecycle.md');
    expect(body).toMatch(/ngOnDestroy/);
    expect(body.toLowerCase()).toMatch(/latch/);
  });
});

describe('formio-angular-form change detection', () => {
  it('covers both modes rather than assuming one', () => {
    const body = reference('change-detection.md');
    expect(body).toContain('zone.js');
    expect(body.toLowerCase()).toContain('zoneless');
  });

  it('names the bridge the component provides', () => {
    const body = reference('change-detection.md');
    expect(body).toContain('ngZone.run');
    expect(body).toContain('runOutsideAngular');
  });

  it('gives the remedy for a handler registered on the instance', () => {
    const body = reference('change-detection.md');
    expect(body).toMatch(/markForCheck|signal\(/);
  });

  it('warns that NgZone.run is a no-op under zoneless', () => {
    expect(reference('change-detection.md').toLowerCase()).toMatch(/no-?op/);
  });
});

describe('formio-angular-form configuration', () => {
  it('documents the one FormioAppConfig', () => {
    const body = reference('config.md');
    expect(body).toContain('FormioAppConfig');
    expect(body).toContain('FormioModule');
  });

  it('has no duelling-symbol section left over', () => {
    const body = reference('config.md');
    expect(body).not.toContain('InjectionToken');
    expect(body).not.toContain('FormioAppService');
  });

  it('warns that the component sets the SDK URLs globally', () => {
    const body = reference('config.md');
    expect(body).toContain('Formio.setBaseUrl');
    expect(body.toLowerCase()).toMatch(/global|every.{0,40}instantiat|clobber/);
  });

  it('gives the multi-project remedy rather than leaving it as a dead end', () => {
    const body = reference('config.md');
    expect(body.toLowerCase()).toMatch(
      /more than one (form\.io )?(project|deployment)|multi-tenant/
    );
    expect(body.toLowerCase()).toMatch(/provide no|without a `?formioappconfig/);
  });

  it('treats anonymous embedding as first-class and diagnoses 401 as access config', () => {
    const body = reference('config.md');
    expect(body.toLowerCase()).toContain('anonymous');
    expect(body).toContain('401');
    expect(body.toLowerCase()).toMatch(/submission access|create permission/);
  });

  it('sources URLs from project_get or the user, with no example host', () => {
    const body = reference('config.md');
    expect(body).toContain('project_get');
    expect(body.toLowerCase()).toContain('ask the user');
    expect(body).toContain('project-urls.md');
    expect(body).not.toContain('examples.form.io');
  });
});

describe('formio-angular-form environments', () => {
  it('rules out the server render pass and gives the Angular-native remedy', () => {
    const body = reference('environments.md');
    expect(body.toLowerCase()).toMatch(/server[- ]render|ssr/);
    expect(body).toMatch(/@defer|isPlatformBrowser/);
    expect(body.toLowerCase()).toMatch(/document is not defined|browser global/);
  });
});

describe('formio-angular-form styling', () => {
  // The component INLINES the renderer stylesheet into its own component styles
  // with ViewEncapsulation.None, which is what gets those rules to DOM the
  // renderer built imperatively. The consequence readers miss is the timing:
  // Angular injects them when the component is first instantiated, not at
  // bootstrap.
  it('states that the component carries the renderer stylesheet already', () => {
    const body = reference('styling.md');
    expect(body).toContain('ViewEncapsulation.None');
    expect(body.toLowerCase()).toContain('formio.form');
    expect(body.toLowerCase()).toMatch(/bootstrap/);
    expect(body.toLowerCase()).toContain('broken');
  });

  it('forbids shipping the renderer stylesheet a second time', () => {
    const body = reference('styling.md');
    expect(body).toContain('angular.json');
    expect(body.toLowerCase()).toMatch(/do not also add|second copy|twice/);
  });

  it('names the first-instantiation timing of the injected styles', () => {
    expect(reference('styling.md').toLowerCase()).toMatch(/first (use|instantiat)/);
  });

  it('points at Templates for changing emitted markup', () => {
    expect(reference('styling.md')).toContain('Templates');
  });
});

// The second path, and the reason it is better than the component choice it
// replaced: it is honestly labelled. You are writing renderer code, you own the
// lifecycle, and the renderer's own skills document what you are holding.
describe('formio-angular-form renderer-directly escape hatch', () => {
  it('names the renderer call and where it goes', () => {
    const body = reference('renderer-directly.md');
    expect(body).toContain('Formio.createForm');
    expect(body).toMatch(/ngAfterViewInit/);
    expect(body).toMatch(/ElementRef|nativeElement/);
  });

  it('says it means leaving the Angular wrapper behind', () => {
    const body = reference('renderer-directly.md').toLowerCase();
    expect(body).toMatch(/@formio\/angular/);
    expect(body).toMatch(/leave|without|no longer|drop/);
  });

  it('states when it is warranted rather than presenting it as a preference', () => {
    const body = reference('renderer-directly.md').toLowerCase();
    expect(body).toMatch(/warrant|reach for (it|this) when|justif/);
  });

  it('spells out all four obligations it hands the reader', () => {
    const body = reference('renderer-directly.md');
    expect(body).toMatch(/destroy\(/);
    expect(body.toLowerCase()).toContain('ngondestroy');
    expect(body.toLowerCase()).toMatch(/unmount|destroyed while|mid-build/);
    expect(body.toLowerCase()).toMatch(/latch/);
    expect(body.toLowerCase()).toMatch(/markforcheck|signal\(/);
  });

  it('routes the renderer API itself to the skills that own it', () => {
    const body = reference('renderer-directly.md');
    expect(body).toContain('formio-form');
    expect(body).toContain('formio-sdk');
  });

  it('does not offer the embed entry point as an easier version of itself', () => {
    expect(reference('renderer-directly.md')).not.toContain('@formio/angular/embed');
  });
});

describe('formio-angular-form custom components', () => {
  it('routes authoring to the renderer and shows Formio.use at module scope', () => {
    const body = skill();
    expect(body).toContain('Formio.use(');
    expect(body.toLowerCase()).toContain('module scope');
    expect(body).toContain('formio-sdk');
  });
});

describe('formio-angular-form form management is out of scope', () => {
  it('names the surfaces without documenting them', () => {
    const body = skill();
    expect(body).toContain('form-builder');
    expect(body).toContain('FormioGrid');
    expect(body.toLowerCase()).toMatch(/no form-management guidance|documents no form-management/);
  });

  it('routes resource list work to the CRUD sub-skill', () => {
    expect(skill()).toContain('formio-angular-resources');
  });
});

describe('the parent dispatches to the embed branch', () => {
  const body = () => readFileSync(parentMd, 'utf8');

  it('names formio-angular-form in a dispatch table', () => {
    expect(body()).toContain('formio-angular-form/SKILL.md');
  });

  it('keeps the embed branch out of the five-phase application chain', () => {
    const text = body().toLowerCase();
    expect(text).toMatch(/re-?dispatch/);
    expect(text).toMatch(/runs none of|does not run/);
  });

  it('no longer says the embed branch opens with a component choice', () => {
    const text = body().toLowerCase();
    expect(text).not.toContain('choosing.md');
    expect(text).not.toContain('thin adapter');
  });

  it('claims Angular embed triggers in the parent description', () => {
    const description = descriptionOf('formio-angular');
    expect(description.toLowerCase()).toContain('embed');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });

  // A trigger list is a promise about what the skill does. Advertising the closed
  // entry point there says an agent should reach for it.
  it('does not advertise the closed entry point as a parent trigger', () => {
    expect(descriptionOf('formio-angular')).not.toContain('@formio/angular/embed');
  });
});

describe('formio-form hands Angular over now that the skill exists', () => {
  const body = () => readFileSync(formSkillMd, 'utf8');

  it('routes an Angular host to the Angular embed branch', () => {
    const text = body();
    expect(text).toContain('formio-angular');
    expect(text.toLowerCase()).toMatch(/before writing mounting code|before you write mounting/);
  });

  it('no longer claims no Angular embedding skill exists', () => {
    const text = body().toLowerCase();
    expect(text).not.toMatch(/no angular embedding skill/);
    expect(text).not.toMatch(/angular embedding skill does not exist/);
  });

  it('names formio-angular in its Not for clause, within budget', () => {
    const description = descriptionOf('formio-form');
    expect(description).toContain('formio-angular');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});

// The library ships no ReactComponent-style Angular base class, and nothing in
// the Angular tree should invent one: a custom component is a renderer class.
describe('no Angular-specific custom component base class is invented', () => {
  it('names no AngularComponent base class anywhere in the Angular skill tree', () => {
    const tree = join(repoRoot, 'plugin/skills/formio-angular');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
      );
    const offenders = walk(tree).filter((file) =>
      readFileSync(file, 'utf8').includes('AngularComponent')
    );
    expect(offenders).toEqual([]);
  });
});
