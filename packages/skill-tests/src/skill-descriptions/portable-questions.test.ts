// A client's question tool may be named as an example, never as the mechanism.
// The portable part is the batching rule — one round per step, never a sequence
// of one-at-a-time prompts — and it has to survive the rewrite intact.

import { describe, expect, it } from 'vitest';
import { liveSkillDocuments, skillDocument } from './helpers.js';

const PORTABLE_WORDING = /question round|structured question mechanism|one round|single round/i;

const documentsNamingAQuestionTool = () =>
  liveSkillDocuments().filter((doc) => doc.body.includes('AskUserQuestion'));

describe('a client question tool is only ever an example', () => {
  it('never appears as a bare call the agent is told to make', () => {
    const offenders = documentsNamingAQuestionTool()
      .filter((doc) => /AskUserQuestion\(\{/.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders, 'a literal call block reads as the mechanism, not an example').toEqual([]);
  });

  it('always sits beside portable instruction wording', () => {
    const offenders = documentsNamingAQuestionTool()
      .filter((doc) => !PORTABLE_WORDING.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('is attributed to the client rather than assumed', () => {
    const offenders = documentsNamingAQuestionTool()
      .filter((doc) => !/in Claude Code, `AskUserQuestion`/.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('no document leans on a client-built-in escape option', () => {
  it('does not rely on an automatic "Other" affordance', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) =>
        /always offers "Other"|"Other" that `AskUserQuestion`|default "Other"/.test(doc.body)
      )
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('the batching rule survives', () => {
  const BATCHING_DOCUMENTS = [
    'plugin/skills/formio-application/SKILL.md',
    'plugin/skills/formio-application/INTENT.md',
    'plugin/skills/formio-angular/SKILL.md',
    'plugin/skills/formio-form-builder/SKILL.md',
    'plugin/skills/formio-form-builder/INTENT.md',
    'plugin/skills/formio-resource-planner/SKILL.md',
    'plugin/skills/formio-angular/formio-angular-resources/SKILL.md',
  ];

  it.each(BATCHING_DOCUMENTS)('%s still says ask in one round', (path) => {
    const { body } = skillDocument(path);

    expect(body).toMatch(PORTABLE_WORDING);
  });

  it.each([
    'plugin/skills/formio-application/SKILL.md',
    'plugin/skills/formio-form-builder/SKILL.md',
    'plugin/skills/formio-resource-planner/SKILL.md',
    'plugin/skills/formio-angular/formio-angular-resources/SKILL.md',
  ])('%s still forbids peppering', (path) => {
    const { body } = skillDocument(path);

    expect(body).toMatch(/do not pepper|peppering/i);
  });
});

describe('the option sets each question offers survive', () => {
  it('INTENT.md keeps both build-vs-modify options', () => {
    const { body } = skillDocument('plugin/skills/formio-application/INTENT.md');

    expect(body).toContain('Build a new app');
    expect(body).toContain('Modify / extend an existing app');
  });

  // The URL interview is gone: the server owns the wording, and the skills relay
  // whichever single value its message names. What must survive in the skills is
  // the handoff field naming and the read surface, not a question round.
  //
  // The fields are `projectUrl` / `baseUrl`, not the FORMIO_* variable names they
  // once borrowed: these are values in the orchestrator's context, and naming them
  // after environment variables told the next phase to go read an environment that
  // no shipped manifest populates.
  it('angular SETUP reads the project from the server instead of interviewing', () => {
    const { body } = skillDocument('plugin/skills/formio-angular/SETUP.md');

    expect(body).toContain('project get');
    expect(body).toContain('`projectUrl`');
    expect(body).toContain('`baseUrl`');
    expect(body).not.toContain('FORMIO_PROJECT_URL');
    expect(body).not.toContain('FORMIO_BASE_URL');
    expect(body).toMatch(/relay/i);
    expect(body).not.toMatch(/three valid shapes/i);
  });

  it('form-builder INTENT keeps the form type and embed intent in one round', () => {
    const { body } = skillDocument('plugin/skills/formio-form-builder/INTENT.md');

    expect(body).toMatch(/webform/);
    expect(body).toMatch(/wizard/);
    expect(body).toMatch(/pdf/);
    expect(body).toMatch(/embed/i);
    expect(body).toMatch(PORTABLE_WORDING);
  });
});
