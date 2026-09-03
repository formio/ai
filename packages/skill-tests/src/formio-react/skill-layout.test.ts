// Structural tests for the `formio-react` parent skill.
//
// `formio-react` is a router over named branches rather than one linear
// procedure: SKILL.md carries the dispatch table and the shared concerns, and
// each branch's steps live in a sibling document. These tests hold that shape,
// the React-only trigger surface, and the description budget.

import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, descriptionOf } from '../skill-descriptions/helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-react');
const skillMd = join(skillDir, 'SKILL.md');

const SIBLINGS = ['SETUP.md', 'BOOTSTRAP.md', 'EXISTING.md', 'CONFIG.md', 'AUTH.md'] as const;

const REQUIRED_TRIGGERS = [
  'build it in React',
  'add Form.io CRUD to my React app',
  '@formio/react',
] as const;

// Generic build-an-app phrasing belongs to formio-application; bare archetypes
// are how a router skill starts stealing plain-language requests.
const BANNED_TRIGGERS = ['build me an app', 'spin up an app', 'task manager', 'help desk'] as const;

function bodyOf(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
}

describe('formio-react parent skill layout', () => {
  it('SKILL.md and every sibling document exist and are non-empty', () => {
    for (const file of ['SKILL.md', ...SIBLINGS]) {
      const full = join(skillDir, file);
      expect(existsSync(full), `${file} must exist`).toBe(true);
      expect(readFileSync(full, 'utf8').trim().length, `${file} must be non-empty`).toBeGreaterThan(
        0
      );
    }
  });

  it('sibling documents carry no skill frontmatter', () => {
    for (const file of SIBLINGS) {
      const body = readFileSync(join(skillDir, file), 'utf8');
      expect(body.startsWith('---\n'), `${file} must not begin with frontmatter`).toBe(false);
    }
  });

  it('declares name formio-react', () => {
    expect(readFileSync(skillMd, 'utf8')).toMatch(/^name:\s*formio-react\s*$/m);
  });

  it('is reachable at .claude/skills/formio-react', () => {
    const link = join(repoRoot, '.claude/skills/formio-react');
    expect(existsSync(link), 'symlink must exist').toBe(true);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(resolve(dirname(link), readlinkSync(link))).toBe(skillDir);
  });
});

describe('formio-react trigger surface', () => {
  const description = () => descriptionOf('formio-react');

  it.each(REQUIRED_TRIGGERS)('claims the React-explicit trigger %s', (trigger) => {
    expect(description().toLowerCase()).toContain(trigger.toLowerCase());
  });

  it.each(BANNED_TRIGGERS)('does not claim the framework-agnostic trigger %s', (trigger) => {
    expect(description().toLowerCase()).not.toContain(trigger.toLowerCase());
  });

  // add-formio-react-form-embedding took the embed row live, so the parent
  // now claims React-named embed phrasing. Framework-agnostic embed triggers
  // still belong to formio-form.
  it('claims React-named embed triggers but not unqualified ones', () => {
    expect(description().toLowerCase()).toContain('embed a form.io form in react');
    expect(description()).not.toMatch(/"embed a form"|"render a form"/);
  });

  it('names every sibling it must disambiguate from', () => {
    for (const sibling of [
      'formio-application',
      'formio-resource-planner',
      'formio-form',
      'formio-angular',
    ]) {
      expect(description()).toContain(sibling);
    }
  });

  it('fits the description budget', () => {
    expect(description().length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});

describe('formio-react is a router, not a procedure', () => {
  const body = () => bodyOf(readFileSync(skillMd, 'utf8'));

  it('carries a dispatch table naming all three branches', () => {
    for (const branch of ['Greenfield application', 'Existing application', 'Embed a form']) {
      expect(body()).toContain(branch);
    }
  });

  it('names each branch chain in the table', () => {
    expect(body()).toContain('BOOTSTRAP.md');
    expect(body()).toContain('EXISTING.md');
    expect(body()).toContain('formio-react-resources/SKILL.md');
  });

  it('marks no dispatch row reserved', () => {
    expect(body()).toContain('formio-react-form/SKILL.md');
    expect(body()).not.toMatch(/Embed a form.*Reserved/);
  });

  it('requires a one-round branch question when the request is ambiguous', () => {
    expect(body()).toMatch(/ONE question round|one question round/);
  });

  it('requires surfacing a workspace that contradicts the stated branch', () => {
    expect(body().toLowerCase()).toContain('contradict');
  });

  // The router holds the table; the steps live in the siblings. If bootstrap or
  // inspection procedure is inlined here, the fork has collapsed back into one
  // all-encompassing document.
  it('does not inline branch procedure', () => {
    expect(body()).not.toMatch(/npm create vite|pnpm create vite/);
  });
});

describe('formio-react greenfield branch', () => {
  const body = () => bodyOf(readFileSync(skillMd, 'utf8'));

  it('runs the five phases in order', () => {
    const order = ['SETUP', 'BOOTSTRAP', 'CONFIG', 'AUTH', 'Resources'];
    const markdown = body();
    const positions = order.map((phase) => markdown.indexOf(phase));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('gates each phase on user approval', () => {
    expect(body().toLowerCase()).toContain('approval gate');
  });

  it('documents resetting to an earlier phase', () => {
    expect(body().toLowerCase()).toMatch(/reset to an earlier phase/);
  });

  it('never runs the planner and never imports', () => {
    expect(body()).toContain('formio-resource-planner');
    expect(body().toLowerCase()).toMatch(/does not run the planner|never runs the planner/);
    expect(body()).toContain('formio-application');
  });
});

describe('formio-react stack constraints', () => {
  const body = () => bodyOf(readFileSync(skillMd, 'utf8'));

  // Both are asserted against the lines that actually SAY "out of scope". A bare
  // containment check on the two names passes just as well on a document that
  // declares them supported, which is the opposite instruction.
  const outOfScope = () => (body().match(/^.*out of scope.*$/gim) ?? []).join('\n');

  it('declares Next.js App Router out of scope', () => {
    expect(outOfScope(), 'SKILL.md must carry an out-of-scope statement').not.toBe('');
    expect(outOfScope()).toContain('Next.js App Router');
  });

  it('declares server-rendered React Router framework mode out of scope', () => {
    expect(outOfScope().toLowerCase()).toContain('framework mode');
  });
});
