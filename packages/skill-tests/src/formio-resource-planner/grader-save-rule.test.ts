// The planner deliberately emits no Save action on a login form (and none on a
// form it leaves without actions), and a login form's Save, when a user asks for
// an audit trail, must never set settings.resource — phase-b-emission.md. The
// grader has to follow the same rule, or every correct plan fails it.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const grader = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../evals/formio-resource-planner/grade.py'
);

interface Expectation {
  text: string;
  passed: boolean;
}

function grade(actions: Record<string, unknown>): Expectation[] {
  const base = mkdtempSync(join(tmpdir(), 'planner-grade-'));
  const outputs = join(base, 'it', 'eval-9-synthetic', 'with_skill', 'outputs');
  mkdirSync(outputs, { recursive: true });
  writeFileSync(join(outputs, 'template.md'), '# Resource Map\n');
  writeFileSync(
    join(outputs, 'template.json'),
    JSON.stringify({
      title: 't',
      name: 't',
      version: '2.0.0',
      roles: {},
      resources: {
        user: { title: 'User', name: 'user', path: 'user', type: 'resource', components: [] },
      },
      forms: {
        userLogin: {
          title: 'Login',
          name: 'userLogin',
          path: 'user/login',
          type: 'form',
          components: [],
        },
        contact: {
          title: 'Contact',
          name: 'contact',
          path: 'contact',
          type: 'form',
          components: [],
        },
      },
      actions: { 'user:save': { name: 'save', form: 'user', settings: {} }, ...actions },
    })
  );
  execFileSync('python3', [grader], {
    env: { ...process.env, ARTIFACTS_DIR: base, ITERATION: 'it' },
  });
  const grading = JSON.parse(readFileSync(join(outputs, '..', 'grading.json'), 'utf8')) as {
    expectations: Expectation[];
  };
  return grading.expectations;
}

const find = (results: Expectation[], prefix: string): Expectation | undefined =>
  results.find((r) => r.text.startsWith(prefix));

describe('the planner grader follows the planner action rules', () => {
  it('accepts a login form that carries only a Login action', () => {
    const results = grade({
      'userLogin:login': { name: 'login', form: 'userLogin', settings: { resources: ['user'] } },
      'contact:save': { name: 'save', form: 'contact', settings: {} },
    });
    expect(find(results, 'Every persisting form')?.passed).toBe(true);
  });

  it('still requires Save on a form that persists', () => {
    const results = grade({
      'userLogin:login': { name: 'login', form: 'userLogin', settings: { resources: ['user'] } },
      'contact:email': { name: 'email', form: 'contact', settings: {} },
      'contact:webhook': { name: 'webhook', form: 'contact', settings: {} },
      'contact:role': { name: 'role', form: 'contact', settings: {} },
    });
    expect(find(results, 'Every persisting form')?.passed).toBe(false);
  });

  it("fails a login form's Save that sets settings.resource", () => {
    const results = grade({
      'userLogin:login': { name: 'login', form: 'userLogin', settings: { resources: ['user'] } },
      'userLogin:save': { name: 'save', form: 'userLogin', settings: { resource: 'user' } },
    });
    expect(find(results, "No login form's Save action sets settings.resource")?.passed).toBe(false);
  });
});
