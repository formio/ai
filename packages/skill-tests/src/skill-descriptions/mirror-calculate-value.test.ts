// The transitive group-access mirror's `calculateValue` is copied literally by
// agents out of the skill documents, so the exact expression is load-bearing:
//
//   value = data.<parent>?.data?.<group> || value;
//
// Why both halves are required is explained once, in
// plugin/skills/formio-resource-planner/references/template-json.md under
// "select — transitive group-access mirror" (verified against the renderer's
// Component.doValueCalculation / calculateComponentValue). In short: without
// `?.` the expression throws on every load where the parent is an unexpanded
// `{ _id }`; without `|| value` a nil result is replaced by `emptyValue`, which
// clears the group reference and silently strips access.
//
// This suite guards every spelling of the expression across the shipped skill
// tree — prose, Mermaid labels, checklist placeholders, and the example
// templates — because the unguarded form shipped once and produced
// "An error occured within custom function for team" on every child screen.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSkillDocuments, repoRoot, skillDocument, type SkillDocument } from './helpers.js';

const examplesDir = 'plugin/skills/formio-resource-planner/references/examples';

function exampleTemplates(): SkillDocument[] {
  return readdirSync(join(repoRoot, examplesDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => skillDocument(`${examplesDir}/${entry.name}/template.json`));
}

/** A key, or a `<placeholder>` standing in for one. */
const SEGMENT = String.raw`(?:[A-Za-z0-9_]+|<[A-Za-z0-9_]+>)`;
/**
 * Any mirror-shaped reference, however guarded, together with what follows it.
 * Global, so a line carrying two expressions — a `<placeholder>` form and a
 * concrete `e.g.` — yields two matches and each is judged on its own. A
 * line-scoped test let a wrong placeholder pass because the correct example
 * beside it satisfied the canonical pattern.
 */
const MIRROR_REFERENCE = new RegExp(
  String.raw`data\.${SEGMENT}\??\.data\??\.${SEGMENT}(?:\s*\|\|\s*value)?`,
  'g'
);
/** The one spelling agents may copy: both `?.` AND the `|| value` fallback. */
const CANONICAL = new RegExp(String.raw`^data\.${SEGMENT}\?\.data\?\.${SEGMENT}\s*\|\|\s*value$`);

const corpus: SkillDocument[] = [...allSkillDocuments(), ...exampleTemplates()];

interface Component {
  key?: string;
  hidden?: boolean;
  reference?: boolean;
  calculateValue?: string;
  components?: Component[];
  columns?: { components?: Component[] }[];
}

function hiddenMirrors(components: Component[]): Component[] {
  return components.flatMap((component) => [
    ...(component.hidden && component.reference && component.calculateValue ? [component] : []),
    ...hiddenMirrors(component.components ?? []),
    ...hiddenMirrors((component.columns ?? []).flatMap((column) => column.components ?? [])),
  ]);
}

describe('transitive group-access mirror — calculateValue guard', () => {
  it('every mirror-shaped expression in the skill tree is the canonical guarded form', () => {
    // A line that names the wrong form in order to warn against it says so.
    const explainsTheWrongForm = (line: string) => /unguarded/i.test(line);
    const offenders = corpus.flatMap((doc) =>
      doc.body
        .split('\n')
        .filter((line) => !explainsTheWrongForm(line))
        .flatMap((line) =>
          [...line.matchAll(MIRROR_REFERENCE)]
            .map((match) => match[0].trim())
            .filter((expression) => !CANONICAL.test(expression))
            .map((expression) => `${doc.path}: ${expression}`)
        )
    );
    expect(offenders).toEqual([]);
  });

  it('every hidden reference mirror in every example template carries both halves of the guard', () => {
    const mirrors = exampleTemplates().flatMap((doc) => {
      const template = JSON.parse(doc.body) as {
        resources?: Record<string, { components?: Component[] }>;
        forms?: Record<string, { components?: Component[] }>;
      };
      return [...Object.values(template.resources ?? {}), ...Object.values(template.forms ?? {})]
        .flatMap((form) => hiddenMirrors(form.components ?? []))
        .map((mirror) => ({
          path: doc.path,
          key: mirror.key,
          calculateValue: mirror.calculateValue ?? '',
        }));
    });
    // The transitive example exists to exercise this shape, so the check is never vacuous.
    expect(mirrors.length).toBeGreaterThan(0);
    // A calculateValue string is `value = <expression>;` — judge the expression.
    const expressionOf = (calculateValue: string) =>
      calculateValue
        .replace(/^\s*value\s*=\s*/, '')
        .replace(/;\s*$/, '')
        .trim();
    const offenders = mirrors.filter(
      (mirror) => !CANONICAL.test(expressionOf(mirror.calculateValue))
    );
    expect(offenders).toEqual([]);
  });

  it('template-json.md explains why each half of the guard is required', () => {
    const body = readFileSync(
      join(repoRoot, 'plugin/skills/formio-resource-planner/references/template-json.md'),
      'utf8'
    );
    expect(body).toContain('emptyValue');
    expect(body.toLowerCase()).toMatch(/cannot read properties of undefined/);
  });
});
