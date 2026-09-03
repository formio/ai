// The formio-react-resources eval harness lives outside the shipped tree, in
// the maintainer-facing test package, and keeps the shape every other harness
// uses so the iteration loop is the same across skills.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const harness = join(repoRoot, 'packages/skill-tests/evals/formio-react-resources');

describe('formio-react-resources eval harness', () => {
  it('lives outside plugin/ with the standard three files', () => {
    for (const file of ['evals.json', 'grade.py', 'README.md']) {
      expect(existsSync(join(harness, file)), `${file} must exist`).toBe(true);
    }
    expect(
      existsSync(join(repoRoot, 'plugin/skills/formio-react/formio-react-resources/evals'))
    ).toBe(false);
  });

  it('seeds a React workspace for the extend eval', () => {
    const seed = join(harness, 'fixtures/existing-workspace-seed');
    expect(existsSync(join(seed, 'package.json'))).toBe(true);
    // The seed must already carry a kernel, or the extend eval cannot test
    // that a pre-existing kernel is reused rather than regenerated.
    expect(existsSync(join(seed, 'src/formio/index.ts'))).toBe(true);
    expect(readFileSync(join(seed, 'package.json'), 'utf8')).toContain('"react"');
  });

  it('covers a simple resource, two levels, three levels, a join, and an extend run', () => {
    const evals = JSON.parse(readFileSync(join(harness, 'evals.json'), 'utf8'));
    expect(evals.skill_name).toBe('formio-react-resources');
    const names = evals.evals.map((e: { name: string }) => e.name).join(' ');
    // `formio-react-resources-skill/spec.md` requires a simple resource as well
    // as the nested cases. Every other prompt declares a parent binding, so
    // without this one the no-parents path — the kernel's simplest shape — is
    // never graded, and the assertion below used to name coverage that the
    // fixture did not have.
    expect(names).toContain('single-resource');
    expect(names).toContain('two-level');
    expect(names).toContain('three-level');
    expect(names).toContain('join');
    expect(names).toContain('extend');
    for (const item of evals.evals) {
      expect(item.prompt.length, `${item.name} needs a prompt`).toBeGreaterThan(0);
      expect(item.expected_output.length, `${item.name} needs expected_output`).toBeGreaterThan(0);
    }
  });

  it('resolves the repository root from its own depth', () => {
    const grader = readFileSync(join(harness, 'grade.py'), 'utf8');
    // harness → evals → skill-tests → packages → root
    expect(grader).toContain('.parent.parent.parent.parent.parent');
    expect(grader).toContain('".eval-artifacts" / "formio-react-resources"');
    expect(grader).toContain('grading.json');
  });

  it('grades the no-parents shape as well as the nested ones', () => {
    const grader = readFileSync(join(harness, 'grade.py'), 'utf8');
    expect(grader).toContain('4: grade_eval_4');
    // The point of the simple case: nothing is invented for a resource that
    // has no ancestor. Asserting the text pins the assertion, not just the
    // grader function's existence.
    expect(grader).toContain('No ancestor binding is invented for a resource that has none');
  });

  it('asserts the hierarchy properties the skill is built around', () => {
    const grader = readFileSync(join(harness, 'grade.py'), 'utf8');
    expect(grader).toContain('distinct route param');
    expect(grader).toContain('imported config objects');
    expect(grader).toContain('applyParentContext');
    expect(grader).toContain('data.<path>._id');
  });

  it('asserts the Angular habits that must not leak back in', () => {
    const grader = readFileSync(join(harness, 'grade.py'), 'utf8');
    expect(grader).toContain('SubmissionTable');
    expect(grader).toContain('clearCache');
    expect(grader).toContain('delete route');
    expect(grader).toContain('react-redux');
  });
});

// The seed's missing renderer stylesheet is deliberate: it is the state
// EXISTING.md's inspection exists to catch, and the only thing outside the new
// resource that eval 3 expects an agent to add. Recorded here so a future
// tidy-up does not silently remove the one thing that exercises the inspection.
describe('the seed workspace carries a deliberate, documented gap', () => {
  const seed = join(harness, 'fixtures/existing-workspace-seed');

  it('omits the renderer stylesheet and says why', () => {
    const entry = readFileSync(join(seed, 'src/main.tsx'), 'utf8');
    expect(entry).toContain('bootstrap/dist/css/bootstrap.min.css');
    // The comment names the file; what must be absent is the import of it.
    expect(entry).not.toMatch(/^import\s+['"][^'"]*formio\.form\.css/m);
    expect(entry).toContain('DELIBERATE GAP');
  });

  it('the runbook records the gap as intentional', () => {
    const readme = readFileSync(join(harness, 'README.md'), 'utf8');
    expect(readme).toContain('formio.form.css');
    expect(readme.toLowerCase()).toContain('deliberate gap');
  });

  it('the grader asserts the backfill happened', () => {
    expect(readFileSync(join(harness, 'grade.py'), 'utf8')).toContain(
      'The missing renderer stylesheet was backfilled'
    );
  });
});

// A post to the item route must branch on intent. Wiring the delete action
// there directly makes every save delete the record.
describe('the seed item route does not delete unconditionally', () => {
  it('wires the intent-branching save action, not the delete action', () => {
    const routes = readFileSync(
      join(harness, 'fixtures/existing-workspace-seed/src/formio/routes.tsx'),
      'utf8'
    );
    const itemRoute = routes.slice(routes.indexOf('path: `:${config.param}`'));
    expect(itemRoute).toMatch(/action:\s*save/);
    expect(itemRoute).not.toMatch(/action:\s*resourceDeleteAction/);
  });
});
