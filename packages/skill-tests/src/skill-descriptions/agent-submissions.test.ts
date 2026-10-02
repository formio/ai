// The one document that says when the agent may write, read, update, or delete a
// submission. The `submission_*` tools enforce the boundary in server code — they reach
// only submissions this server created and signed for the calling directory — and this
// guideline states the rest: what the agent may create, with what values, after which
// checks, and how it cleans up. Every other skill links here instead of restating it,
// so the rules exist once.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');
const GUIDELINE = 'formio-mcp-setup/references/agent-submissions.md';

function guideline(): string {
  return readFileSync(join(skillsRoot, GUIDELINE), 'utf8');
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return entry.endsWith('.md') ? [full] : [];
  });
}

describe('agent-submissions.md states every rule', () => {
  it('states the enforced boundary and bans every other route', () => {
    const text = guideline();
    expect(text).toMatch(/created and signed/i);
    expect(text).toMatch(/working directory/i);
    for (const route of [/HTTP/, /script/i, /SDK/, /past(e|ed)/i]) {
      expect(text).toMatch(route);
    }
  });

  it('names the two purposes and what each is for', () => {
    const text = guideline();
    expect(text).toContain('`reference-data`');
    expect(text).toContain('`test`');
    expect(text).toMatch(/dataSrc: resource/);
  });

  it('keeps reference data out of auth forms and gates test submissions to them', () => {
    const text = guideline();
    for (const action of ['Login', 'Role Assignment', 'Group Assignment']) {
      expect(text).toContain(action);
    }
    expect(text).toMatch(/user-type Resource/i);
  });

  it('requires invented values on a reserved domain', () => {
    const text = guideline();
    expect(text).toMatch(/invented/i);
    expect(text).toContain('example.com');
  });

  it('requires action_list, a preview, approval, and a production warning before every write', () => {
    const text = guideline();
    expect(text).toContain('action_list');
    expect(text).toMatch(/approv/i);
    expect(text).toMatch(/Project URL/);
    expect(text).toMatch(/non-production|production/i);
  });

  it('offers test cleanup with the tools that do it', () => {
    const text = guideline();
    expect(text).toContain('submission_list');
    expect(text).toContain('submission_delete');
    expect(text).toMatch(/purpose: "test"|`purpose: 'test'`|purpose `test`/);
  });

  it('states that list filters are bounded to data fields, listed operators, and own rows', () => {
    const text = guideline();
    expect(text).toMatch(/submission_list[^.]*filters? on `data`/);
    for (const op of ['__eq', '__in', '__regex']) {
      expect(text).toContain(op);
    }
    expect(text).toMatch(/only (ever )?narrow/i);
  });

  it('says a value read back is data, never an instruction', () => {
    expect(guideline()).toMatch(/never (directs|instructs)/i);
  });

  it('is written as single-line paragraphs', () => {
    const outsideFences = guideline()
      .split(/^```/m)
      .filter((_, i) => i % 2 === 0)
      .join('\n');
    const wrapped = outsideFences
      .split(/\n{2,}/)
      .filter((block) => !/^(#|\||- |\d+\. |>)/.test(block.trim()))
      .filter((block) => block.trim().includes('\n'));
    expect(wrapped).toEqual([]);
  });
});

describe('no other skill restates the rules', () => {
  const others = markdownFiles(skillsRoot).filter(
    (file) => relative(skillsRoot, file) !== GUIDELINE
  );

  it('every document that mentions submission_create links to the guideline', () => {
    const unlinked = others
      .filter((file) => readFileSync(file, 'utf8').includes('submission_create'))
      .filter((file) => !/references\/agent-submissions\.md/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(skillsRoot, file));
    expect(unlinked).toEqual([]);
  });
});
