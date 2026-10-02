// The library's prose about submissions describes the tools that exist. After the
// skills.sh remediation it said no submission tool existed and that reference data is
// seeded by an administrator in the portal; the `submission_*` tools now reach the
// agent's own signed submissions, so each of those statements names them instead —
// while the ban on reaching any other submission by another route stays.

import { describe, expect, it } from 'vitest';
import { skillDocument } from './helpers.js';

function section(path: string, heading: string): string {
  const { body } = skillDocument(path);
  const start = body.indexOf(heading);
  expect(start, `${path} has "${heading}"`).toBeGreaterThanOrEqual(0);
  const next = body.indexOf('\n## ', start + 1);
  return body.slice(start, next === -1 ? undefined : next);
}

describe('formio-actions describes the scoped tools', () => {
  const ACTIONS = 'plugin/skills/formio-actions/SKILL.md';

  it('names the submission tools and their scope in the build-time section', () => {
    const text = section(ACTIONS, '## Build time vs runtime');
    expect(text).toMatch(/submission_\*|submission_create/);
    expect(text).toMatch(/created and signed/i);
    expect(text).toContain('agent-submissions.md');
  });

  it('keeps the ban on reaching any other submission', () => {
    const text = section(ACTIONS, '## Build time vs runtime');
    expect(text).toMatch(/HTTP/);
    expect(text).toMatch(/script/i);
    expect(text).not.toMatch(/no submission-read tool/i);
    expect(text).not.toMatch(/toolset cannot reach a submission/i);
  });
});

describe('the planner hands initial reference rows to submission_create', () => {
  it.each([
    'plugin/skills/formio-resource-planner/references/phase-b-emission.md',
    'plugin/skills/formio-resource-planner/references/template-json.md',
  ])('%s names submission_create and keeps ongoing administration in the portal', (path) => {
    const { body } = skillDocument(path);
    expect(body).toContain('submission_create');
    expect(body).toContain('agent-submissions.md');
    expect(body).toMatch(/project portal/i);
    expect(body).not.toMatch(/responsibilities \(seeding reference data/);
  });
});
