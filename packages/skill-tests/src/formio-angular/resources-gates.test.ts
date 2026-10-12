// formio-angular-resources extends an existing Angular workspace, wiring
// FormioAppConfig into one that lacks it. It never creates a workspace — that is
// formio-angular's application branch — and it never asks for a URL, because
// project_get resolves both. Its round-1 questions and Phase B used to offer both.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const subSkillDir = join(repoRoot, 'plugin/skills/formio-angular/formio-angular-resources');
const read = (rel: string): string => readFileSync(join(subSkillDir, rel), 'utf8');

const markdownUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownUnder(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });

// The numbered questions of round 1 in SKILL.md.
function roundOne(text: string, heading: string): string {
  const start = text.indexOf(heading);
  if (start === -1) throw new Error(`no "${heading}"`);
  const next = text.indexOf('\n#', start + heading.length);
  return text.slice(start, next === -1 ? text.length : next);
}

describe('formio-angular-resources asks no URL question', () => {
  it('the batching rule names no URL and no new-workspace choice', () => {
    const batching = read('SKILL.md')
      .split('\n')
      .find((line) => line.startsWith('- **Batch your questions.**'));
    expect(batching).toBeDefined();
    // The choices the round asks about: everything before "together in ONE question round".
    const asked = (batching ?? '').split('together in ONE question round')[0];
    expect(asked).not.toMatch(/base URL|project URL/i);
    expect(batching).not.toMatch(/existing-vs-new workspace/);
    expect(batching).toMatch(/never part of that round/);
  });

  it.each([
    ['SKILL.md', '### 1. Confirm workspace context'],
    ['references/interview-guide.md', '## Round 1'],
  ])('%s round 1 asks for the workspace root and no URL', (file, heading) => {
    const round = roundOne(read(file), heading);
    const questions = round.split('\n').filter((line) => /^\d+\. \*\*/.test(line));
    expect(questions.some((line) => /\*\*Workspace root\*\*/.test(line))).toBe(true);
    expect(questions.filter((line) => /project URL|Base URL/i.test(line.slice(0, 60)))).toEqual([]);
    expect(round).toContain('project_get');
  });
});

describe('formio-angular-resources creates no workspace', () => {
  it.each([
    'SKILL.md',
    'references/interview-guide.md',
    'references/phase-a-plan-template.md',
    'references/worked-example.md',
  ])('%s offers no new-workspace mode', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/New or existing Angular workspace/);
    expect(text).not.toMatch(/mode = new workspace/);
    expect(text).not.toMatch(/Mode: <?new workspace/);
    expect(text).not.toMatch(/ng new <app-name>|ng new task-manager/);
  });

  it('routes only a missing workspace to formio-angular, and wires an existing one', () => {
    const round = roundOne(read('SKILL.md'), '### 1. Confirm workspace context');
    expect(round).toMatch(/`formio-angular`/);
    expect(round).toMatch(/never creates a workspace/);
    expect(round).not.toMatch(/not yet wired, stop/);
    expect(round).toMatch(/not yet wired[^.]*app-integration\.md/);
  });

  it('the interview guide agrees', () => {
    const guide = read('references/interview-guide.md');
    expect(guide).not.toMatch(/`FormioAppConfig` wired\. With no such workspace, stop/);
    expect(guide).toMatch(/not yet wired[^.]*app-integration\.md/);
  });
});

describe('formio-angular-resources cites the orchestrator as it is', () => {
  it('names no retired orchestrator Step 5', () => {
    const text = read('SKILL.md');
    expect(text).not.toMatch(/orchestrator Step 5/);
    expect(text).not.toMatch(/formio-application`? Step 5/);
  });

  it("links to FRAMEWORK.md's handoff reference rather than restating the orchestrator contract", () => {
    expect(read('SKILL.md')).toContain(
      '../../formio-application/FRAMEWORK.md#handoff-context-reference'
    );
  });

  it('names no repository path', () => {
    const offenders = markdownUnder(subSkillDir).filter((path) =>
      readFileSync(path, 'utf8').includes('plugin/skills/')
    );
    expect(offenders).toEqual([]);
  });
});
