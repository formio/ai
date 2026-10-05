// Where the library uses the agent's own submissions: seeding the Resource a
// `select` reads, and writing a test submission to check a form or an action. Each
// step is optional, sits behind its own approval, and defers to the canonical
// guideline for the rules rather than restating them.

import { describe, expect, it } from 'vitest';
import { skillDocument } from './helpers.js';

const GUIDELINE_LINK = /formio-mcp-setup\/references\/agent-submissions\.md/;

function body(path: string): string {
  return skillDocument(path).body;
}

describe('formio-form-builder seeds and tests after SAVE', () => {
  const skill = () => body('plugin/skills/formio-form-builder/SKILL.md');
  const save = () => body('plugin/skills/formio-form-builder/SAVE.md');

  it('SKILL.md names both optional steps after SAVE and links the guideline', () => {
    const text = skill();
    const saveStep = text.indexOf('### Step 3 — SAVE');
    const embedStep = text.indexOf('### Step 4 — EMBED');
    const after = text.slice(saveStep, embedStep);
    expect(after).toContain('submission_create');
    expect(after).toMatch(/dataSrc: resource/);
    expect(after).toMatch(/test submission/i);
    expect(after).toMatch(GUIDELINE_LINK);
  });

  it('SAVE.md puts each step behind an approval and offers cleanup of test rows', () => {
    const text = save();
    expect(text).toMatch(/reference-data/);
    expect(text).toMatch(/purpose: "test"|`test`/);
    expect(text).toMatch(/approv/i);
    expect(text).toContain('submission_delete');
    expect(text).toMatch(GUIDELINE_LINK);
  });
});

describe('formio-application offers reference data after import', () => {
  it('has its own gate after import that does not block framework routing', () => {
    const text = body('plugin/skills/formio-application/SKILL.md');
    const start = text.indexOf('### Step 3.6');
    expect(start).toBeGreaterThan(text.indexOf('### Step 3.5'));
    const step = text.slice(start, text.indexOf('### Step 4', start));
    expect(step).toContain('submission_create');
    expect(step).toMatch(/Seed:/);
    expect(step).toMatch(/approv/i);
    expect(step).toMatch(/declin(e|ing)[^.]*(Step 4|routing)/i);
    expect(step).toMatch(GUIDELINE_LINK);
  });
});

describe('formio-actions tests an action with a test submission', () => {
  it('names the effect, gets approval, writes one test row, and offers cleanup', () => {
    const text = body('plugin/skills/formio-actions/SKILL.md');
    const start = text.indexOf('## Testing an action');
    expect(start).toBeGreaterThan(0);
    const section = text.slice(start, text.indexOf('\n## ', start + 1));
    expect(section).toContain('submission_create');
    expect(section).toMatch(/recipients/i);
    expect(section).toMatch(/webhook/i);
    expect(section).toMatch(/approv/i);
    expect(section).toContain('submission_delete');
    expect(section).toMatch(GUIDELINE_LINK);
  });
});

describe('the planner marks Resources that need seed rows', () => {
  it('template-md.md defines the Seed line and when to emit it', () => {
    const text = body('plugin/skills/formio-resource-planner/references/template-md.md');
    expect(text).toMatch(/Seed: reference-data/);
    expect(text).toMatch(/select/);
    expect(text).toMatch(/omit/i);
  });
});
