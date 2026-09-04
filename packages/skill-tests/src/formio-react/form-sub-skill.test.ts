// The `formio-react-form` embedding sub-skill.
//
// Scope is mounting and wiring only: everything that lives in the form
// DEFINITION stays owned by formio-form and is reached by link, because that
// content is identical whatever renders the form.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, descriptionOf } from '../skill-descriptions/helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const parentMd = join(repoRoot, 'plugin/skills/formio-react/SKILL.md');
const subSkillDir = join(repoRoot, 'plugin/skills/formio-react/formio-react-form');
const subSkillMd = join(subSkillDir, 'SKILL.md');
const formSkillMd = join(repoRoot, 'plugin/skills/formio-form/SKILL.md');

const REFERENCES = [
  'mounting.md',
  'control.md',
  'lifecycle.md',
  'environments.md',
  'provider.md',
  'styling.md',
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

describe('formio-react-form layout and triggers', () => {
  it('exists with a name matching its directory', () => {
    expect(existsSync(subSkillMd)).toBe(true);
    expect(skill()).toMatch(/^name:\s*formio-react-form\s*$/m);
  });

  it('ships all six references, non-empty and frontmatter-free', () => {
    for (const file of REFERENCES) {
      const full = join(subSkillDir, 'references', file);
      expect(existsSync(full), `${file} must exist`).toBe(true);
      const body = readFileSync(full, 'utf8');
      expect(body.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
      expect(body.startsWith('---\n')).toBe(false);
    }
  });

  it('claims React-named embed triggers only', () => {
    const description = descriptionOf('formio-react/formio-react-form');
    expect(description).toContain('React');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    for (const sibling of ['formio-form', 'formio-react-resources', 'formio-form-builder']) {
      expect(description).toContain(sibling);
    }
  });

  it('states it is loaded by path and does not activate on its own', () => {
    const body = skill().toLowerCase();
    expect(body).toContain('loaded by path');
    expect(body).toContain('not a separately-registered top-level skill');
  });
});

describe('formio-react-form scope boundary', () => {
  it.each(DEFINITION_TOPICS)('does not document %s', (topic) => {
    // Naming the topic while routing away is fine; documenting it is not.
    const offenders = REFERENCES.filter((file) => {
      const body = reference(file);
      const mentions = body.includes(topic);
      const routes = body.includes('formio-form');
      return mentions && !routes;
    });
    expect(offenders, `${topic} must route to formio-form, not be documented here`).toEqual([]);
  });

  it('links to formio-form for definition behaviour', () => {
    expect(skill()).toContain('formio-form');
  });
});

describe('formio-react-form mounting and control', () => {
  it('documents source precedence and who fetches', () => {
    const body = reference('mounting.md');
    expect(body).toMatch(/`form`.{0,80}precedence|precedence.{0,80}`form`/s);
    expect(body).toContain('src');
  });

  it('marks the deprecated prop aliases', () => {
    const body = allReferences();
    expect(body).toContain('formioform');
    expect(body).toContain('formReady');
    expect(body.toLowerCase()).toContain('deprecated');
  });

  it('documents the event props and the otherEvents escape hatch', () => {
    const body = reference('control.md');
    expect(body).toContain('otherEvents');
    expect(body).toContain('onFormReady');
  });

  it('captures the instance in a ref, not state', () => {
    const body = reference('control.md');
    expect(body.toLowerCase()).toContain('ref');
    expect(body.toLowerCase()).toMatch(/not.{0,20}state|rather than state/);
  });
});

describe('formio-react-form lifecycle guidance', () => {
  it('puts actionable guidance before internals, and labels the internals', () => {
    const body = reference('lifecycle.md');
    const actionable = body.toLowerCase().indexOf('memoi');
    const internals = body.toLowerCase().indexOf('# part two');
    expect(actionable).toBeGreaterThan(-1);
    expect(internals).toBeGreaterThan(actionable);
  });

  it('documents the options-identity trap as usage, not a library defect', () => {
    const body = reference('lifecycle.md');
    expect(body).toContain('options');
    expect(body.toLowerCase()).toMatch(/every (parent )?render/);
    expect(body.toLowerCase()).toContain('not a library defect');
  });

  it('states that changing submission is cheap', () => {
    expect(reference('lifecycle.md').toLowerCase()).toMatch(/submission.{0,120}live instance/s);
  });

  it('requires cloning reused form definitions', () => {
    expect(reference('lifecycle.md').toLowerCase()).toMatch(/clone/);
  });

  it('reports observed StrictMode behaviour and never offers disabling it', () => {
    const body = reference('lifecycle.md');
    expect(body).toContain('StrictMode');
    expect(body.toLowerCase()).toMatch(/hides the defect|not a remedy/);
    // It may say NOT to remove it; it must never offer removal as the fix.
    expect(body.toLowerCase()).toMatch(/do not remove strictmode/);
  });
});

describe('formio-react-form environments', () => {
  it('names the Vite React plugin', () => {
    expect(reference('environments.md')).toContain('@vitejs/plugin-react');
  });

  it('addresses the Next.js client-component misconception', () => {
    const body = reference('environments.md');
    expect(body).toContain('ssr: false');
    expect(body.toLowerCase()).toMatch(/not sufficient|is not enough/);
  });
});

describe('formio-react-form provider and anonymous embedding', () => {
  it('documents the provider and that the hook throws outside it', () => {
    const body = reference('provider.md');
    expect(body).toContain('FormioProvider');
    expect(body).toContain('useFormioContext');
    expect(body.toLowerCase()).toContain('throws');
  });

  it('treats anonymous embedding as first-class and diagnoses 401 as access config', () => {
    const body = reference('provider.md');
    expect(body.toLowerCase()).toContain('anonymous');
    expect(body).toContain('401');
    expect(body.toLowerCase()).toMatch(/submission access|create permission/);
  });

  it('sources URLs from project_get with no example host', () => {
    const body = reference('provider.md');
    expect(body).toContain('project_get');
    expect(body).not.toContain('examples.form.io');
  });
});

describe('formio-react-form styling', () => {
  // The renderer DOES ship CSS — `@formio/js/dist/formio.form.css` — and this
  // assertion previously required the doc to say the opposite. Bootstrap does not
  // substitute for it: it carries the `.formio-*` and `.choices*` rules, so a form
  // rendered without it has unstyled reference selects. Assert both halves are
  // named, and that the symptom is still described as looking broken rather than
  // erroring.
  it('names both stylesheets a rendered form needs, and the symptom', () => {
    const body = reference('styling.md');
    const lower = body.toLowerCase();
    expect(lower).toContain('formio.form.css');
    expect(lower).toMatch(/bootstrap/);
    expect(lower).toContain('broken');
  });

  it('points at Templates for changing emitted markup', () => {
    expect(reference('styling.md')).toContain('Templates');
  });
});

describe('formio-react-form custom components', () => {
  // A custom component is authored once against @formio/js and registered
  // through Formio.use — the same call every host uses. The deprecated
  // ReactComponent base class is not named at all: mentioning it, even as a
  // migration target, puts it in front of readers who would otherwise never
  // meet it.
  it('routes authoring to the renderer and shows Formio.use at module scope', () => {
    const body = skill();
    expect(body).toContain('Formio.use(');
    expect(body.toLowerCase()).toContain('module scope');
    expect(body).toContain('formio-sdk');
  });

  it('never mentions ReactComponent anywhere in the React skill tree', () => {
    const tree = join(repoRoot, 'plugin/skills/formio-react');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
      );
    const offenders = walk(tree).filter((file) =>
      readFileSync(file, 'utf8').includes('ReactComponent')
    );
    expect(offenders).toEqual([]);
  });

  it('warns off the legacy Redux modules', () => {
    const body = skill() + allReferences();
    expect(body.toLowerCase()).toMatch(/legacy redux|redux modules/);
  });
});

describe('formio-react-form form management is out of scope', () => {
  it('names the components without documenting them', () => {
    const body = skill();
    expect(body).toContain('FormEdit');
    expect(body).toContain('FormGrid');
    expect(body.toLowerCase()).toMatch(/no form-management guidance|documents no form-management/);
  });

  it('routes resource list work to the CRUD sub-skill', () => {
    expect(skill()).toContain('formio-react-resources');
  });
});

describe('the parent dispatch table goes live', () => {
  it('names formio-react-form and marks no row reserved', () => {
    const body = readFileSync(parentMd, 'utf8');
    expect(body).toContain('formio-react-form/SKILL.md');
    expect(body).not.toMatch(/Embed a form.*Reserved/);
  });

  it('keeps the embed branch out of the application chain', () => {
    const body = readFileSync(parentMd, 'utf8');
    expect(body.toLowerCase()).toMatch(/re-?dispatch/);
  });

  it('claims React embed triggers in the parent description', () => {
    const description = descriptionOf('formio-react');
    expect(description.toLowerCase()).toContain('embed');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});

describe('formio-form host check', () => {
  const body = () => readFileSync(formSkillMd, 'utf8');

  it('hands a React workspace to formio-react before writing mounting code', () => {
    expect(body()).toContain('formio-react');
    expect(body().toLowerCase()).toMatch(/before writing mounting code|before you write mounting/);
  });

  it('is bounded — not a dispatch table, and no interview', () => {
    const text = body().toLowerCase();
    expect(text).toMatch(/not a (framework )?dispatch table/);
    expect(text).toMatch(/rather than asking|without asking/);
  });

  // Angular used to have no embedding skill, and this asserted that formio-form
  // said so. It has one now, so the truth to tell is the handoff.
  it('tells the truth about Angular', () => {
    const text = body();
    expect(text).toContain('@formio/angular');
    expect(text).toContain('formio-angular');
    expect(text.toLowerCase()).not.toMatch(
      /no angular embedding skill|angular embedding skill does not exist/
    );
  });

  it('names formio-react in its Not for clause, within budget', () => {
    const description = descriptionOf('formio-form');
    expect(description).toContain('formio-react');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});

// A generated screen hands the renderer's `onSubmit` to a route action. If that
// handler runs twice on a create route it writes TWO records, milliseconds apart,
// and the result looks like data somebody meant to create — the redirect lands on
// one of them, the list shows two plausible rows, the console stays silent.
//
// The latch must be a ref: the duplicate arrives in the same tick, before React
// re-renders, so `navigation.state` is still 'idle' and a disabled button has not
// yet disabled. This pins both the pattern and the reason, because the obvious
// fix (disable the button) does not work and would otherwise get "simplified" in.
describe('formio-react-resources — submit latch', () => {
  const patterns = () =>
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../plugin/skills/formio-react/formio-react-resources/references/resource-patterns.md'
      ),
      'utf8'
    );

  it('the canonical save example latches before submitting', () => {
    const body = patterns();
    expect(body).toContain('inFlight');
    expect(body).toMatch(/if \(inFlight\.current\) return/);
  });

  it('says why the latch is a ref rather than navigation.state', () => {
    const body = patterns().toLowerCase();
    expect(body).toContain('same tick');
    expect(body).toMatch(/navigation\.state/);
  });

  it('names the consequence as duplicate records', () => {
    expect(patterns().toLowerCase()).toMatch(/two records|writes two/);
  });
});

// A wizard is built as a wizard in the portal; the embed is agnostic to display.
// What the React skill documents is the one React-specific concern — the
// application driving the wizard's flow from its own UI.
describe('formio-react-form wizard guidance is flow control, not display selection', () => {
  const mounting = () => reference('mounting.md');

  it('states the embed is display-agnostic', () => {
    expect(mounting().toLowerCase()).toContain('agnostic to how a form displays');
  });

  it('documents driving the wizard through the controller pattern', () => {
    const body = mounting();
    expect(body).toContain('buttonSettings');
    expect(body).toContain('onNextPage');
    expect(body).toContain('nextPage()');
    expect(body).toContain('prevPage()');
  });

  it('links the page API to formio-form rather than restating it', () => {
    expect(mounting()).toContain('formio-form/references/wizards.md');
  });

  it('shows no display switching at embed time', () => {
    const fences = [...mounting().matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
      .map((m) => m[1])
      .join('\n');
    expect(fences).not.toMatch(/display:\s*['"](wizard|pdf)['"]/);
    expect(fences).not.toMatch(/FormClass=\{Wizard\}/);
  });
});
