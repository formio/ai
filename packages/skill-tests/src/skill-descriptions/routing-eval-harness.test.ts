// The routing eval measures which skill a request reaches. It reads every
// registered skill's description at run time, so a description edit is measured
// against the text that ships — never against a copy kept in the harness.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkills } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const harness = join(repoRoot, 'packages/skill-tests/evals/skill-routing');
const skillsRoot = join(repoRoot, 'plugin/skills');

interface RoutingEval {
  id: string;
  prompt: string;
  expected_skill: string;
  also_accept?: string[];
  must_not?: string[];
}

const registered = (): string[] =>
  readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name);

const evals = (): RoutingEval[] =>
  (JSON.parse(readFileSync(join(harness, 'evals.json'), 'utf8')) as { evals: RoutingEval[] }).evals;

describe('skill-routing eval harness', () => {
  it.each(['evals.json', 'grade.py', 'README.md'])('has %s', (name) => {
    expect(existsSync(join(harness, name))).toBe(true);
  });

  it('names a registered skill, or none, for every prompt', () => {
    const known = new Set([...registered(), 'none']);
    const unknown = evals().flatMap((entry) =>
      [entry.expected_skill, ...(entry.also_accept ?? []), ...(entry.must_not ?? [])].filter(
        (name) => !known.has(name)
      )
    );
    expect(unknown).toEqual([]);
  });

  it('gives every prompt a unique id', () => {
    const ids = evals().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('expects every registered skill at least once', () => {
    const expected = new Set(evals().map((entry) => entry.expected_skill));
    expect(registered().filter((name) => !expected.has(name))).toEqual([]);
  });

  it.each(['grade.py', 'README.md'])('%s carries no copy of a description', (name) => {
    const text = readFileSync(join(harness, name), 'utf8');
    const copied = allSkills()
      .filter((skill) => text.includes(skill.description.slice(0, 80)))
      .map((skill) => skill.path);
    expect(copied).toEqual([]);
  });
});
