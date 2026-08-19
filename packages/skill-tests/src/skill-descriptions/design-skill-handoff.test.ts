// `frontend-design` is a portable Agent Skill — plain frontmatter, design-only
// body, distributed in a `skills/` directory any client can read. So it is named
// by name here. What must NOT appear is one client's distribution machinery:
// its plugin marketplace commands and its reload command.
//
// Some strings here are also covered by the general ratchet in
// agent-neutral-prose.test.ts. That suite owns the library-wide rule; this one
// asserts the specific contract, so a failure here names what broke.

import { describe, expect, it } from 'vitest';
import { liveSkillDocuments, skillDocument } from './helpers.js';

const FRAMEWORK_MD = 'plugin/skills/formio-application/FRAMEWORK.md';
const BOOTSTRAP_MD = 'plugin/skills/formio-angular/BOOTSTRAP.md';

describe('no client-specific install machinery', () => {
  const FORBIDDEN = ['claude plugin install', 'claude-plugins-official', '/reload-plugins'];

  it.each(FORBIDDEN)('no live document contains "%s"', (needle) => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes(needle))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('points at where the skill actually ships instead', () => {
    const { body } = skillDocument(FRAMEWORK_MD);

    expect(body).toContain('github.com/anthropics/claude-plugins-public');
    expect(body).toMatch(
      /however this client|whatever route this client|like any other Agent Skill/i
    );
  });
});

describe('the frontend-design handoff contract', () => {
  const contractDocuments = () =>
    liveSkillDocuments().filter((doc) => doc.body.includes('frontendDesignStatus'));

  it('is named on both sides of the handoff', () => {
    const paths = contractDocuments().map((doc) => doc.path);

    expect(paths).toContain(FRAMEWORK_MD);
    expect(paths).toContain('plugin/skills/formio-application/SKILL.md');
    expect(paths.some((path) => path.startsWith('plugin/skills/formio-angular/'))).toBe(true);
  });

  it.each([
    FRAMEWORK_MD,
    'plugin/skills/formio-application/SKILL.md',
    'plugin/skills/formio-angular/formio-angular-resources/SKILL.md',
  ])('%s enumerates both values', (path) => {
    const { body } = skillDocument(path);

    expect(body).toMatch(/'available'/);
    expect(body).toMatch(/'declined'/);
  });

  it('no document still carries the interim generic name', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('designSkillStatus'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('detection matches the skill, not one client prefix', () => {
  it.each([FRAMEWORK_MD, BOOTSTRAP_MD])('%s accepts more than one registered form', (path) => {
    const { body } = skillDocument(path);

    // The namespaced form may be MENTIONED as one possibility; what is banned is
    // treating it as the only form to look for.
    expect(body).toMatch(/bare name `frontend-design`|bare `frontend-design`/);
    expect(body).toMatch(/frontend-design:frontend-design/);
    expect(body).toMatch(/any\W+of those forms|one form only/i);
  });

  it('BOOTSTRAP keeps the single-form match called out as the historical bug', () => {
    const { body } = skillDocument(BOOTSTRAP_MD);

    expect(body).toMatch(/historical bug/i);
  });
});

describe('the never-emit-unstyled-UI guarantee survives', () => {
  it('FRAMEWORK.md offers the install and forbids silent plain UI', () => {
    const { body } = skillDocument(FRAMEWORK_MD);

    expect(body).toMatch(/Step 4a/);
    expect(body).toMatch(/strongly recommended but not required/i);
    expect(body).toMatch(/do NOT silently emit plain UI/i);
  });

  it('the declined path applies the Bootstrap 5 brief inline and discloses it', () => {
    const { body } = skillDocument(FRAMEWORK_MD);

    expect(body).toMatch(/Bootstrap 5 brief/);
    expect(body).toMatch(/BOOTSTRAP\.md/);
    expect(body).toMatch(/disclos/i);
    expect(body).toMatch(/approval gate/i);
  });

  it('BOOTSTRAP still routes the brief through FRONTEND_DESIGN_BRIEF', () => {
    const { body } = skillDocument(BOOTSTRAP_MD);

    expect(body).toContain('FRONTEND_DESIGN_BRIEF');
  });
});

describe('skill installs target the running client', () => {
  it('no live document hardcodes -a claude-code', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('-a claude-code'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('BOOTSTRAP.md documents the universal skills directory as the default', () => {
    const { body } = skillDocument(BOOTSTRAP_MD);

    expect(body).toContain('.agents/skills');
    expect(body).toMatch(/detected client|client you are running|running client/i);
  });
});
